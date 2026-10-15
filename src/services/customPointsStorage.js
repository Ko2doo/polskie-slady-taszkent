/**
 * CustomPointsStorage
 *
 * Purpose:
 *   Keeps custom points in a JSON file and survives a killed app, a full disk and a damaged file.
 *
 * Why two slots:
 *   The Filesystem plugin does not write atomically (a crash in the middle of a write leaves a broken file),
 *   and its rename deletes the target first. So there is no safe "write a temp file, then replace" here.
 *   Instead the data is written to two files alternately. Every save has a revision, the older slot is
 *   overwritten, the newer one is never touched. On load the valid slot with the highest revision wins,
 *   a half-written slot simply loses to the previous one: the last edit may be lost, the data never.
 *
 * Safety rules:
 *   - A slot that could not be read (an error, not "file does not exist") makes the storage read-only,
 *     otherwise "could not read" would look like "empty" and the next save would overwrite good data
 *   - Data written by a newer app version is never touched (read-only)
 *   - If both slots are damaged, their content is copied to "*.corrupt" files before starting from scratch
 *
 * Saving is debounced and coalesced (only the latest snapshot is written), writes never overlap.
 * flush() writes immediately, call it when the app goes to the background.
 *
 * Usage:
 *   const storage = createCustomPointsStorage({ driver: dataFilesDriver, onNotice });
 *   const { status, points } = await storage.load();
 *   storage.schedule(() => snapshotOfPoints);   // after every change
 *   await storage.flush();                      // when the app goes to the background
 */

import { createLogger, IS_DEBUG } from '@/utils/debugMode';
import { buildStorageFile, parseFile } from './customPointsFormat';

const customPointsStorageLogger = createLogger('CustomPointsStorage');

export const SLOT_PATHS = ['custom-points/slot-a.json', 'custom-points/slot-b.json'];

const DEFAULT_DEBOUNCE_MS = 400;

/**
 * @param {Object} options
 * @param {{ read: Function, write: Function }} options.driver - read(path) -> text | null (missing), throws on errors;
 *   write(path, text) throws on errors
 * @param {Function} [options.onNotice] - Called with a code: StoreUnsupported | StoreUnreadable | StoreCorrupted
 *   | StoreSaveFailed
 * @param {Function} [options.now] - Current unix time in ms
 * @param {number} [options.debounceMs] - Delay before a scheduled save is written
 */
export function createCustomPointsStorage({
  driver,
  onNotice = () => {},
  now = () => Date.now(),
  debounceMs = DEFAULT_DEBOUNCE_MS,
}) {
  // The slot that holds the newest valid data (-1: none yet)
  let current = { index: -1, revision: 0 };
  let readOnly = false;

  let snapshotGetter = null;
  let timer = null;
  let queue = Promise.resolve();

  async function readSlot(path) {
    try {
      const text = await driver.read(path);

      if (text === null) return { path, missing: true };

      return { path, text, parsed: parseFile(text, { kind: 'storage', now: now() }) };
    } catch (error) {
      return { path, error };
    }
  }

  async function loadSlots() {
    const slots = await Promise.all(SLOT_PATHS.map(readSlot));

    // Never write when something could not be read
    if (slots.some((slot) => slot.error)) {
      readOnly = true;
      onNotice('StoreUnreadable');
      return { status: 'unreadable', points: [] };
    }

    let best = null;

    slots.forEach((slot, index) => {
      if (slot.parsed && slot.parsed.ok && (!best || slot.parsed.revision > best.revision)) {
        best = { index, revision: slot.parsed.revision, points: slot.parsed.points };
      }
    });

    // Written by a newer app version (an unknown revision counts as the newest)
    const newerSlots = slots.filter((slot) => slot.parsed && slot.parsed.reason === 'unsupportedVersion');
    const newestRevision = Math.max(
      ...newerSlots.map((slot) => (slot.parsed.revision === null ? Infinity : slot.parsed.revision)),
    );

    if (newerSlots.length > 0 && (!best || newestRevision >= best.revision)) {
      readOnly = true;
      onNotice('StoreUnsupported');
      return { status: 'unsupported', points: [] };
    }

    if (best) {
      current = { index: best.index, revision: best.revision };

      IS_DEBUG && customPointsStorageLogger.log(`Loaded revision ${best.revision} from slot ${best.index}`);

      return { status: 'ok', points: best.points };
    }

    const existing = slots.filter((slot) => slot.text !== undefined);

    if (existing.length === 0) {
      return { status: 'empty', points: [] };
    }

    // Files exist, but none is valid: keep a copy for recovery and start from scratch
    await Promise.all(
      existing.map(async (slot) => {
        try {
          await driver.write(`${slot.path}.corrupt`, slot.text);
        } catch (error) {
          IS_DEBUG && customPointsStorageLogger.error('Failed to keep a copy of the damaged file:', error);
        }
      }),
    );

    onNotice('StoreCorrupted');
    return { status: 'corrupt', points: [] };
  }

  /**
   * @returns {Promise<{ status: 'empty'|'ok'|'corrupt'|'unsupported'|'unreadable', points: Array }>}
   */
  async function load() {
    try {
      return await loadSlots();
    } catch (error) {
      // An unexpected failure must not end up as "empty": the next save would overwrite the data
      IS_DEBUG && customPointsStorageLogger.error('Failed to load:', error);

      readOnly = true;
      onNotice('StoreUnreadable');
      return { status: 'unreadable', points: [] };
    }
  }

  async function writeSnapshot(getter) {
    const revision = current.revision + 1;
    const index = current.index === 0 ? 1 : 0;

    try {
      await driver.write(SLOT_PATHS[index], buildStorageFile(getter(), { revision, now: now() }));

      current = { index, revision };

      IS_DEBUG && customPointsStorageLogger.log(`Saved revision ${revision} to slot ${index}`);

      return true;
    } catch (error) {
      IS_DEBUG && customPointsStorageLogger.error('Failed to save:', error);
      onNotice('StoreSaveFailed');
      return false;
    }
  }

  /**
   * Write the latest scheduled snapshot now (waits for the writes in progress)
   * @returns {Promise<void>}
   */
  function flush() {
    clearTimeout(timer);
    timer = null;

    queue = queue.then(async () => {
      if (readOnly || !snapshotGetter) return;

      const getter = snapshotGetter;
      snapshotGetter = null;

      const isSaved = await writeSnapshot(getter);

      // Not saved: try again on the next flush, unless there is a newer snapshot already
      if (!isSaved && !snapshotGetter) {
        snapshotGetter = getter;
      }
    });

    return queue;
  }

  /**
   * Remember the latest state and write it after a short pause
   * @param {Function} getter - Returns the points to save (called when the write really happens)
   */
  function schedule(getter) {
    if (readOnly) return;

    snapshotGetter = getter;

    clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  }

  return {
    load,
    schedule,
    flush,

    get isReadOnly() {
      return readOnly;
    },
  };
}
