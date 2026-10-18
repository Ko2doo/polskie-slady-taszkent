import { onAppBackground } from '@/capacitor/services/appLifecycle';
import { dataFilesDriver } from '@/capacitor/utils/appFiles';
import { LIMITS, buildExportFile, parseFile, sanitizePhotos } from '@/services/customPointsFormat';
import { mergeImportedPoints } from '@/services/customPointsMerge';
import { deletePointPhotos, reconcilePhotos } from '@/services/customPointsPhotos';
import { createCustomPointsStorage } from '@/services/customPointsStorage';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';
import { createId, isId } from '@/utils/uuid';

const customPointsStateLogger = createLogger('CustomPointsState');

/**
 * Custom points state
 *
 * This is a module-level singleton on purpose: the map (builder) and the article popup
 * must read the same data. Do not turn it into a factory, every call of a factory
 * would create an independent copy of the state.
 *
 * Points are saved to a JSON file (see customPointsStorage) after every change and loaded when the module
 * is imported. Wait for `ready` before reading `points` at the start of the app.
 *
 * Point shape:
 *   - id          - unique id (UUID v4), used by the map popup to open the article and to merge imported points
 *   - coords      - { lng, lat } in WGS84
 *   - title       - article title
 *   - description - article text (plain text, NOT html)
 *   - preview     - preview image URL, empty string if there is none (local only: never exported)
 *   - photos      - up to LIMITS.maxPhotos photo paths, the first one is the cover (local only: never exported).
 *                   The files are managed by customPointsPhotos
 *   - createdAt   - unix time in ms
 *   - updatedAt   - unix time in ms, changes only when the title, the description or the coords change
 */
const points = $state([]);

// Problems found by the storage (see customPointsStorage), shown to the user by the app shell
const notices = $state([]);

const storage = createCustomPointsStorage({
  driver: dataFilesDriver,
  onNotice: (code) => notices.push(code),
});

function persist() {
  storage.schedule(() => $state.snapshot(points));
}

function clip(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

/**
 * The startup check of the photos (see reconcilePhotos). Not awaited by anyone: it must never delay the start.
 */
async function cleanUpPhotos() {
  try {
    const { pointsWithoutFolder } = await reconcilePhotos($state.snapshot(points));

    // The photos are gone (e.g. a restored backup): do not keep paths that lead nowhere
    for (const id of pointsWithoutFolder) {
      const point = points.find((item) => item.id === id);

      if (point) point.photos = [];
    }

    if (pointsWithoutFolder.length > 0) persist();
  } catch (error) {
    // Nothing is deleted or changed if the folder could not be listed
    IS_DEBUG && customPointsStateLogger.error('Failed to check the photos:', error);
  }
}

/**
 * Parse an import file and merge it with the current points — nothing is changed yet
 * @param {string} text - The file content
 * @returns {{ ok: true, skipped: number, merged: ReturnType<typeof mergeImportedPoints> }
 *   | { ok: false, reason: string }} the merge to apply, or why the file is refused
 */
function analyzeImport(text) {
  const parsed = parseFile(text, { kind: 'import' });
  if (!parsed.ok) {
    IS_DEBUG && customPointsStateLogger.warn('Import refused:', parsed.reason);
    return { ok: false, reason: parsed.reason };
  }

  return { ok: true, skipped: parsed.skipped, merged: mergeImportedPoints($state.snapshot(points), parsed.points) };
}

async function hydrate() {
  const { status, points: loaded } = await storage.load();

  // Points added before the loading finished stay (it can not really happen, but losing data is worse)
  const loadedIds = new Set(loaded.map((point) => point.id));
  const early = $state.snapshot(points).filter((point) => !loadedIds.has(point.id));

  points.splice(0, points.length, ...loaded, ...early);

  if (early.length > 0) persist();

  IS_DEBUG && customPointsStateLogger.log(`Hydrated: ${status}, ${loaded.length} points`);

  // Only with the data loaded completely: with an empty or a partial list every folder would look like an orphan
  if (status === 'ok') cleanUpPhotos();
}

export const customPointsState = {
  /** Resolves when the saved points are loaded */
  ready: hydrate(),

  get points() {
    return points;
  },

  get notices() {
    return notices;
  },

  /**
   * Take the pending storage notices (and clear them)
   * @returns {Array<string>} - StoreUnsupported | StoreUnreadable | StoreCorrupted | StoreSaveFailed
   */
  takeNotices() {
    return notices.splice(0, notices.length);
  },

  /**
   * Add a new point
   * @param {Object} data - { coords: { lng, lat }, title, description, preview, photos, id }
   *   `id` is optional: a form can create it when it opens, so the photos of a point that is not saved yet
   *   already have a folder. An invalid or a used id is replaced with a new one.
   *   `photos` are accepted only if they belong to the id of the point.
   * @returns {Object} - Created point
   */
  add(data) {
    const now = Date.now();
    const id = isId(data.id) && !points.some((point) => point.id === data.id) ? data.id : createId();

    const point = {
      id,
      coords: { lng: data.coords.lng, lat: data.coords.lat },
      title: clip(data.title, LIMITS.title),
      description: clip(data.description, LIMITS.description),
      preview: typeof data.preview === 'string' ? data.preview : '',
      photos: sanitizePhotos(data.photos, id),
      createdAt: now,
      updatedAt: now,
    };

    points.push(point);
    persist();

    IS_DEBUG && customPointsStateLogger.log(`Point "${point.id}" added`);

    return point;
  },

  /**
   * Find a point by id
   * @param {string} id - Point id
   * @returns {Object|null} - Point or null if not found
   */
  getById(id) {
    const found = points.find((point) => point.id === id);

    if (!found) {
      return null;
    }

    return found;
  },

  /**
   * Update the editable data of a point (title, article text, preview, photos).
   * The id and coordinates are not changed.
   * @param {string} id - Point id
   * @param {Object} data - { title, description, preview, photos }, all fields are optional
   * @returns {Object|null} - Updated point or null if not found
   */
  update(id, data) {
    const point = points.find((item) => item.id === id);

    if (!point) {
      return null;
    }

    let isChanged = false;

    if (typeof data.title === 'string') {
      const title = clip(data.title, LIMITS.title);

      if (title !== point.title) {
        point.title = title;
        isChanged = true;
      }
    }

    if (typeof data.description === 'string') {
      const description = clip(data.description, LIMITS.description);

      if (description !== point.description) {
        point.description = description;
        isChanged = true;
      }
    }

    // The preview and the photos are local only, they do not make the point "newer"
    if (typeof data.preview === 'string') {
      point.preview = data.preview;
    }

    if (Array.isArray(data.photos)) {
      point.photos = sanitizePhotos(data.photos, id);
    }

    if (isChanged) {
      // Always moves forward, even if the clock of the device went back
      point.updatedAt = Math.max(Date.now(), point.updatedAt + 1);
    }

    persist();

    IS_DEBUG && customPointsStateLogger.log(`Point "${id}" updated`);

    return point;
  },

  /**
   * Remove a point by id
   * @param {string} id - Point id
   */
  remove(id) {
    const index = points.findIndex((point) => point.id === id);

    if (index === -1) return;

    points.splice(index, 1);
    persist();

    // In the background: if the app is killed before it ends, the startup check removes the folder
    deletePointPhotos(id).catch((error) => {
      IS_DEBUG && customPointsStateLogger.error(`Failed to delete the photos of "${id}":`, error);
    });

    IS_DEBUG && customPointsStateLogger.log(`Point "${id}" removed`);
  },

  /**
   * Write the points to the file right now
   * @returns {Promise<void>}
   */
  flush() {
    return storage.flush();
  },

  /**
   * The export file of every point (customPointsFormat.buildExportFile: shared fields only).
   * Waits for the saved points, so an export right after the start doesn't come out empty.
   * @returns {Promise<{ text: string, count: number }>} the file content and how many points it holds
   */
  async exportFile() {
    await customPointsState.ready;

    const snapshot = $state.snapshot(points);
    return { text: buildExportFile(snapshot), count: snapshot.length };
  },

  /**
   * What an import of this file would do, without doing it — for the "N will be added, M updated"
   * confirmation. Same counts and refusals as importFile.
   * @param {string} text - The file content
   * @returns {Promise<{ ok: true, added: number, updated: number, unchanged: number, skipped: number }
   *   | { ok: false, reason: string }>} see importFile
   */
  async previewImport(text) {
    await customPointsState.ready;

    const analysis = analyzeImport(text);
    if (!analysis.ok) return analysis;

    const { added, updated, unchanged } = analysis.merged;
    return { ok: true, added, updated, unchanged, skipped: analysis.skipped };
  },

  /**
   * Import an export file: validated as untrusted input, merged by id (the fresher `updatedAt`
   * wins, local photos stay, nothing is deleted — customPointsMerge.js) and saved at once.
   * Merged against the points as they are now, so a preview made earlier can't go stale.
   * @param {string} text - The file content
   * @returns {Promise<{ ok: true, added: number, updated: number, unchanged: number, skipped: number }
   *   | { ok: false, reason: string }>} the counts (`skipped` — broken entries in the file), or why
   *   the file was refused (parseFile's reason: tooLarge | invalidJson | unknownFormat | invalidFile
   *   | unsupportedVersion | tooManyPoints | checksumMismatch)
   */
  async importFile(text) {
    await customPointsState.ready;

    const analysis = analyzeImport(text);
    if (!analysis.ok) return analysis;

    const { points: merged, added, updated, unchanged } = analysis.merged;
    const { skipped } = analysis;

    if (added + updated > 0) {
      points.splice(0, points.length, ...merged);
      persist();
      // An import is one big change the user just asked for: saved now, not after the debounce
      await storage.flush();
    }

    IS_DEBUG &&
      customPointsStateLogger.log(
        `Imported: +${added}, updated ${updated}, unchanged ${unchanged}, skipped ${skipped}`,
      );

    return { ok: true, added, updated, unchanged, skipped };
  },
};

let isPersistenceBound = false;

/**
 * Save the points as soon as the app goes to the background: the system can kill it there,
 * and a debounced save could still be waiting.
 * Call once at the start of the app.
 */
export function initCustomPointsPersistence() {
  if (isPersistenceBound) return;

  isPersistenceBound = true;

  // App-lifetime listener: never removed
  onAppBackground(() => customPointsState.flush());
}
