import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCustomPointsStorage, SLOT_PATHS } from '@/services/customPointsStorage';
import { buildStorageFile, computeChecksum, FORMAT, SCHEMA_VERSION } from '@/services/customPointsFormat';
import { dataFilesDriver } from '@/capacitor/utils/appFiles';

const [SLOT_A, SLOT_B] = SLOT_PATHS;
const NOW = 1_760_000_000_000;
const DEBOUNCE_MS = 400;

const point = (id, title = 'Point') => ({
  id,
  title,
  description: '',
  coords: { lng: 69.24, lat: 41.31 },
  preview: '',
  photos: [],
  createdAt: NOW - 1000,
  updatedAt: NOW - 1000,
});

const P1 = point('3f2504e0-4f89-41d3-9a0c-0305e82c3301', 'One');
const P2 = point('7c9e6679-7425-40de-944b-e07fc1f90ae7', 'Two');

const slotText = (points, revision) => buildStorageFile(points, { revision, now: NOW });

const newerAppText = (revision) =>
  JSON.stringify({
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION + 1,
    ...(revision === undefined ? {} : { revision }),
    checksum: computeChecksum([]),
    points: [],
  });

/**
 * In-memory driver that records every call. `files` holds the "disk"; `failReads` / `failWrites`
 * make a path throw, the way a real I/O error would.
 */
function createDriver(files = {}) {
  const driver = {
    files: { ...files },
    failReads: new Set(),
    failWrites: new Set(),
    reads: [],
    writes: [],

    async read(path) {
      driver.reads.push(path);
      if (driver.failReads.has(path)) throw new Error(`read failed: ${path}`);
      return path in driver.files ? driver.files[path] : null;
    },

    async write(path, text) {
      driver.writes.push(path);
      if (driver.failWrites.has(path)) throw new Error(`write failed: ${path}`);
      driver.files[path] = text;
    },
  };

  return driver;
}

function createStorage(driver, onNotice = vi.fn()) {
  const storage = createCustomPointsStorage({ driver, onNotice, now: () => NOW, debounceMs: DEBOUNCE_MS });
  return { storage, onNotice };
}

const revisionOf = (text) => JSON.parse(text).revision;

describe('load', () => {
  it('reports empty when no slot exists', async () => {
    const { storage, onNotice } = createStorage(createDriver());

    expect(await storage.load()).toEqual({ status: 'empty', points: [] });
    expect(onNotice).not.toHaveBeenCalled();
    expect(storage.isReadOnly).toBe(false);
  });

  it('reads both slots', async () => {
    const driver = createDriver();
    const { storage } = createStorage(driver);

    await storage.load();

    expect(driver.reads.sort()).toEqual([...SLOT_PATHS].sort());
  });

  it('picks the valid slot with the higher revision', async () => {
    const { storage } = createStorage(createDriver({ [SLOT_A]: slotText([P1], 4), [SLOT_B]: slotText([P2], 5) }));

    expect(await storage.load()).toEqual({ status: 'ok', points: [P2] });
  });

  it('falls back to the other slot when the newer one is half-written', async () => {
    const broken = slotText([P2], 6).slice(0, 40);
    const { storage, onNotice } = createStorage(createDriver({ [SLOT_A]: slotText([P1], 5), [SLOT_B]: broken }));

    expect(await storage.load()).toEqual({ status: 'ok', points: [P1] });
    expect(onNotice).not.toHaveBeenCalled();
  });

  it('falls back when the newer slot has a checksum mismatch', async () => {
    const tampered = slotText([P2], 6).replace('"Two"', '"Tw0"');
    const { storage } = createStorage(createDriver({ [SLOT_A]: slotText([P1], 5), [SLOT_B]: tampered }));

    expect((await storage.load()).points).toEqual([P1]);
  });

  // "Could not read" must never look like "empty": the next save would overwrite good data
  it('becomes read-only when a slot cannot be read', async () => {
    const driver = createDriver({ [SLOT_A]: slotText([P1], 5) });
    driver.failReads.add(SLOT_B);
    const { storage, onNotice } = createStorage(driver);

    expect(await storage.load()).toEqual({ status: 'unreadable', points: [] });
    expect(storage.isReadOnly).toBe(true);
    expect(onNotice).toHaveBeenCalledWith('StoreUnreadable');
  });

  it('treats a read that throws synchronously as unreadable', async () => {
    const driver = createDriver();
    driver.read = () => {
      throw new Error('sync crash'); // not even a rejected promise
    };
    const { storage, onNotice } = createStorage(driver);

    expect((await storage.load()).status).toBe('unreadable');
    expect(storage.isReadOnly).toBe(true);
    expect(onNotice).toHaveBeenCalledWith('StoreUnreadable');
  });

  describe('data written by a newer app version', () => {
    it('is read-only when the newer-version slot is the newest', async () => {
      const { storage, onNotice } = createStorage(
        createDriver({ [SLOT_A]: slotText([P1], 5), [SLOT_B]: newerAppText(6) }),
      );

      expect(await storage.load()).toEqual({ status: 'unsupported', points: [] });
      expect(storage.isReadOnly).toBe(true);
      expect(onNotice).toHaveBeenCalledWith('StoreUnsupported');
    });

    it('is read-only when the newer-version slot has no revision (counts as newest)', async () => {
      const { storage } = createStorage(createDriver({ [SLOT_A]: slotText([P1], 5), [SLOT_B]: newerAppText() }));

      expect((await storage.load()).status).toBe('unsupported');
    });

    it('is read-only on an equal revision', async () => {
      const { storage } = createStorage(createDriver({ [SLOT_A]: slotText([P1], 5), [SLOT_B]: newerAppText(5) }));

      expect((await storage.load()).status).toBe('unsupported');
    });

    it('is ignored when it is older than our own valid slot', async () => {
      const { storage } = createStorage(createDriver({ [SLOT_A]: slotText([P1], 5), [SLOT_B]: newerAppText(4) }));

      expect(await storage.load()).toEqual({ status: 'ok', points: [P1] });
      expect(storage.isReadOnly).toBe(false);
    });

    it('is read-only when it is the only slot', async () => {
      const { storage } = createStorage(createDriver({ [SLOT_A]: newerAppText(1) }));

      expect((await storage.load()).status).toBe('unsupported');
    });
  });

  describe('both slots damaged', () => {
    it('keeps a copy of every damaged file and reports corrupt', async () => {
      const driver = createDriver({ [SLOT_A]: 'garbage-a', [SLOT_B]: '{"format":"psl.custom-points"' });
      const { storage, onNotice } = createStorage(driver);

      expect(await storage.load()).toEqual({ status: 'corrupt', points: [] });
      expect(driver.files[`${SLOT_A}.corrupt`]).toBe('garbage-a');
      expect(driver.files[`${SLOT_B}.corrupt`]).toBe('{"format":"psl.custom-points"');
      expect(onNotice).toHaveBeenCalledWith('StoreCorrupted');
      expect(storage.isReadOnly).toBe(false);
    });

    it('copies only the slots that exist', async () => {
      const driver = createDriver({ [SLOT_B]: 'garbage' });
      const { storage } = createStorage(driver);

      await storage.load();

      expect(driver.writes).toEqual([`${SLOT_B}.corrupt`]);
    });

    it('still reports corrupt when keeping a copy fails', async () => {
      const driver = createDriver({ [SLOT_A]: 'garbage' });
      driver.failWrites.add(`${SLOT_A}.corrupt`);
      const { storage } = createStorage(driver);

      expect((await storage.load()).status).toBe('corrupt');
    });
  });
});

describe('saving', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes the first save to slot A with revision 1', async () => {
    const driver = createDriver();
    const { storage } = createStorage(driver);
    await storage.load();

    storage.schedule(() => [P1]);
    await storage.flush();

    expect(driver.writes).toEqual([SLOT_A]);
    expect(revisionOf(driver.files[SLOT_A])).toBe(1);
  });

  it('alternates slots and increments the revision', async () => {
    const driver = createDriver();
    const { storage } = createStorage(driver);
    await storage.load();

    for (const points of [[P1], [P1, P2], [P2]]) {
      storage.schedule(() => points);
      await storage.flush();
    }

    expect(driver.writes).toEqual([SLOT_A, SLOT_B, SLOT_A]);
    expect(revisionOf(driver.files[SLOT_A])).toBe(3);
    expect(revisionOf(driver.files[SLOT_B])).toBe(2);
  });

  // The newest slot is never overwritten: a crash mid-write only damages the older one
  it('writes into the slot other than the one loaded', async () => {
    const driver = createDriver({ [SLOT_A]: slotText([P1], 4), [SLOT_B]: slotText([P1], 7) });
    const { storage } = createStorage(driver);
    await storage.load();

    storage.schedule(() => [P2]);
    await storage.flush();

    expect(driver.writes).toEqual([SLOT_A]);
    expect(revisionOf(driver.files[SLOT_A])).toBe(8);
    expect(revisionOf(driver.files[SLOT_B])).toBe(7);
  });

  it('overwrites the damaged slot first when only one slot is valid', async () => {
    const driver = createDriver({ [SLOT_A]: 'garbage', [SLOT_B]: slotText([P1], 3) });
    const { storage } = createStorage(driver);
    await storage.load();

    storage.schedule(() => [P2]);
    await storage.flush();

    expect(driver.writes).toEqual([SLOT_A]);
    expect(revisionOf(driver.files[SLOT_B])).toBe(3);
  });

  it('a saved state survives a reload', async () => {
    const driver = createDriver();
    const first = createStorage(driver).storage;
    await first.load();
    first.schedule(() => [P1, P2]);
    await first.flush();

    const second = createStorage(driver).storage;

    expect(await second.load()).toEqual({ status: 'ok', points: [P1, P2] });
  });

  describe('debounce', () => {
    it('writes only after the pause, once, with the latest snapshot', async () => {
      const driver = createDriver();
      const { storage } = createStorage(driver);
      await storage.load();
      const getter = vi.fn(() => [P2]);

      storage.schedule(() => [P1]);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
      storage.schedule(getter);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);

      expect(driver.writes).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);

      expect(driver.writes).toEqual([SLOT_A]);
      expect(getter).toHaveBeenCalledTimes(1);
      expect(JSON.parse(driver.files[SLOT_A]).points).toEqual([P2]);
    });

    it('takes the snapshot when writing, not when scheduling', async () => {
      const driver = createDriver();
      const { storage } = createStorage(driver);
      await storage.load();
      let points = [P1];

      storage.schedule(() => points);
      points = [P1, P2];
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);

      expect(JSON.parse(driver.files[SLOT_A]).points).toEqual([P1, P2]);
    });

    it('flush writes immediately and cancels the pending timer', async () => {
      const driver = createDriver();
      const { storage } = createStorage(driver);
      await storage.load();

      storage.schedule(() => [P1]);
      await storage.flush();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS * 2);

      expect(driver.writes).toEqual([SLOT_A]);
    });

    it('flush with nothing scheduled writes nothing', async () => {
      const driver = createDriver();
      const { storage } = createStorage(driver);
      await storage.load();

      await storage.flush();

      expect(driver.writes).toEqual([]);
    });
  });

  it('never runs two writes at once', async () => {
    const driver = createDriver();
    let active = 0;
    let maxActive = 0;
    const write = driver.write;
    driver.write = async (path, text) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await write(path, text);
      active -= 1;
    };
    const { storage } = createStorage(driver);
    await storage.load();

    storage.schedule(() => [P1]);
    const first = storage.flush();
    await vi.advanceTimersByTimeAsync(10); // the first write is now in progress
    storage.schedule(() => [P2]);
    const second = storage.flush();
    await vi.advanceTimersByTimeAsync(200);
    await Promise.all([first, second]);

    expect(maxActive).toBe(1);
    expect(driver.writes).toEqual([SLOT_A, SLOT_B]);
  });

  it('coalesces snapshots scheduled before a queued write starts', async () => {
    const driver = createDriver();
    const { storage } = createStorage(driver);
    await storage.load();

    storage.schedule(() => [P1]);
    const first = storage.flush();
    storage.schedule(() => [P2]); // the queued write hasn't started yet: it picks this one up
    await Promise.all([first, storage.flush()]);

    expect(driver.writes).toEqual([SLOT_A]);
    expect(JSON.parse(driver.files[SLOT_A]).points).toEqual([P2]);
  });

  describe('a failed write', () => {
    it('reports StoreSaveFailed and keeps the revision', async () => {
      const driver = createDriver();
      driver.failWrites.add(SLOT_A);
      const { storage, onNotice } = createStorage(driver);
      await storage.load();

      storage.schedule(() => [P1]);
      await storage.flush();

      expect(onNotice).toHaveBeenCalledWith('StoreSaveFailed');
      expect(driver.files[SLOT_A]).toBeUndefined();
    });

    it('is retried on the next flush, into the same slot', async () => {
      const driver = createDriver();
      driver.failWrites.add(SLOT_A);
      const { storage } = createStorage(driver);
      await storage.load();

      storage.schedule(() => [P1]);
      await storage.flush();
      driver.failWrites.clear();
      await storage.flush();

      expect(driver.writes).toEqual([SLOT_A, SLOT_A]);
      expect(revisionOf(driver.files[SLOT_A])).toBe(1);
    });

    it('is replaced by a newer snapshot scheduled meanwhile', async () => {
      const driver = createDriver();
      driver.failWrites.add(SLOT_A);
      const { storage } = createStorage(driver);
      await storage.load();

      storage.schedule(() => [P1]);
      const failing = storage.flush();
      storage.schedule(() => [P2]); // arrives while the failing write is in progress
      await failing;
      driver.failWrites.clear();
      await storage.flush();

      expect(JSON.parse(driver.files[SLOT_A]).points).toEqual([P2]);
    });
  });

  describe('read-only storage', () => {
    it('never writes after an unreadable load', async () => {
      const driver = createDriver({ [SLOT_A]: slotText([P1], 5) });
      driver.failReads.add(SLOT_B);
      const { storage } = createStorage(driver);
      await storage.load();

      storage.schedule(() => [P2]);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      await storage.flush();

      expect(driver.writes).toEqual([]);
    });

    it('drops a snapshot scheduled before load once load turns read-only', async () => {
      const driver = createDriver({ [SLOT_A]: slotText([P1], 5) });
      driver.failReads.add(SLOT_B);
      const { storage } = createStorage(driver);

      storage.schedule(() => [P2]);
      await storage.load();
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
      await storage.flush();

      expect(driver.writes).toEqual([]);
    });

    it('never writes over data of a newer app version', async () => {
      const driver = createDriver({ [SLOT_A]: newerAppText(9) });
      const { storage } = createStorage(driver);
      await storage.load();

      storage.schedule(() => [P2]);
      await storage.flush();

      expect(driver.writes).toEqual([]);
      expect(driver.files[SLOT_A]).toBe(newerAppText(9));
    });
  });
});

describe('with the real Filesystem driver (web implementation over IndexedDB)', () => {
  it('saves, reloads, and keeps alternating slots on disk', async () => {
    const first = createCustomPointsStorage({ driver: dataFilesDriver, now: () => NOW, debounceMs: 0 });
    expect((await first.load()).status).toBe('empty');

    first.schedule(() => [P1]);
    await first.flush();
    first.schedule(() => [P1, P2]);
    await first.flush();

    const second = createCustomPointsStorage({ driver: dataFilesDriver, now: () => NOW });

    expect(await second.load()).toEqual({ status: 'ok', points: [P1, P2] });
    expect(revisionOf(await dataFilesDriver.read(SLOT_A))).toBe(1);
    expect(revisionOf(await dataFilesDriver.read(SLOT_B))).toBe(2);
  });
});
