import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LIMITS, buildExportFile } from '@/services/customPointsFormat';
import { createId } from '@/utils/uuid';

// The storage, the photo files and the app lifecycle are recorders: this state only decides what to
// keep and when to save. The real storage is covered by customPointsStorage.test.js, the files by
// customPointsPhotos.test.js. Each test sets the recorders' behavior through `deps`.
const deps = vi.hoisted(() => ({}));

vi.mock('@/services/customPointsStorage', () => ({
  createCustomPointsStorage: ({ onNotice }) => {
    deps.onNotice = onNotice;

    return {
      load: (...args) => deps.load(...args),
      schedule: (...args) => deps.schedule(...args),
      flush: (...args) => deps.flush(...args),
    };
  },
}));

vi.mock('@/services/customPointsPhotos', () => ({
  deletePointPhotos: (...args) => deps.deletePointPhotos(...args),
  reconcilePhotos: (...args) => deps.reconcilePhotos(...args),
}));

vi.mock('@/capacitor/services/appLifecycle', () => ({
  onAppBackground: (...args) => deps.onAppBackground(...args),
}));

const photoOf = (pointId) => `photos/${pointId}/${createId()}.jpg`;

function storedPoint(overrides = {}) {
  const id = overrides.id ?? createId();

  return {
    id,
    coords: { lng: 69.24, lat: 41.3 },
    title: 'Stored',
    description: '',
    preview: '',
    photos: [],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

const newPoint = (overrides = {}) => ({ coords: { lng: 69.25, lat: 41.31 }, title: 'New', ...overrides });

// The state hydrates itself when the module is imported: every test imports a fresh copy
let state;
let module;

async function load({ status = 'empty', points = [] } = {}) {
  deps.load = vi.fn(async () => ({ status, points }));

  vi.resetModules();
  module = await import('@/lib/state/customPointsState.svelte.js');
  state = module.customPointsState;

  await state.ready;
  // The photo check is started, not awaited, by the hydration
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// What the next save would write (the storage reads the points through this getter)
const lastSaved = () => deps.schedule.mock.lastCall[0]();

beforeEach(() => {
  deps.schedule = vi.fn();
  deps.flush = vi.fn(async () => {});
  deps.deletePointPhotos = vi.fn(async () => {});
  deps.reconcilePhotos = vi.fn(async () => ({ removedOrphans: 0, pointsWithoutFolder: [] }));
  deps.onAppBackground = vi.fn();
});

describe('hydration', () => {
  it('loads the saved points', async () => {
    const saved = [storedPoint(), storedPoint()];

    await load({ status: 'ok', points: saved });

    expect(state.points).toEqual(saved);
    expect(deps.schedule).not.toHaveBeenCalled();
  });

  it('checks the photos only after a complete load', async () => {
    const saved = [storedPoint()];

    await load({ status: 'ok', points: saved });

    expect(deps.reconcilePhotos).toHaveBeenCalledWith(saved);
  });

  // With an empty or partial list every photo folder would look like an orphan
  it.each(['empty', 'corrupt', 'unsupported', 'unreadable'])(
    'never checks the photos after a "%s" load',
    async (status) => {
      await load({ status });

      expect(deps.reconcilePhotos).not.toHaveBeenCalled();
    },
  );

  it('drops photo paths of points whose folder is gone, and saves', async () => {
    const lost = storedPoint();
    lost.photos = [photoOf(lost.id)];
    const kept = storedPoint();
    kept.photos = [photoOf(kept.id)];
    deps.reconcilePhotos = vi.fn(async () => ({ removedOrphans: 0, pointsWithoutFolder: [lost.id] }));

    await load({ status: 'ok', points: [lost, kept] });

    expect(state.getById(lost.id).photos).toEqual([]);
    expect(state.getById(kept.id).photos).toEqual(kept.photos);
    expect(lastSaved()).toHaveLength(2);
  });

  it('changes nothing when the photo check fails', async () => {
    const point = storedPoint();
    point.photos = [photoOf(point.id)];
    deps.reconcilePhotos = vi.fn(async () => {
      throw new Error('Permission denied');
    });

    await load({ status: 'ok', points: [point] });

    expect(state.points[0].photos).toEqual(point.photos);
    expect(deps.schedule).not.toHaveBeenCalled();
  });

  // Losing data is worse than an unlikely race
  it('keeps a point added before the loading finished, and saves it', async () => {
    const saved = storedPoint();
    let finishLoading;
    deps.load = vi.fn(
      () =>
        new Promise((resolve) => {
          finishLoading = () => resolve({ status: 'ok', points: [saved] });
        }),
    );

    vi.resetModules();
    const { customPointsState } = await import('@/lib/state/customPointsState.svelte.js');
    const early = customPointsState.add(newPoint());
    finishLoading();
    await customPointsState.ready;

    expect(customPointsState.points.map((point) => point.id)).toEqual([saved.id, early.id]);
    expect(deps.schedule).toHaveBeenCalled();
  });
});

describe('notices', () => {
  it('collects the storage notices until they are taken', async () => {
    await load();

    deps.onNotice('StoreCorrupted');
    deps.onNotice('StoreSaveFailed');

    expect(state.notices).toEqual(['StoreCorrupted', 'StoreSaveFailed']);
    expect(state.takeNotices()).toEqual(['StoreCorrupted', 'StoreSaveFailed']);
    expect(state.notices).toEqual([]);
  });
});

describe('add', () => {
  beforeEach(() => load());

  it('creates a point and saves', () => {
    vi.spyOn(Date, 'now').mockReturnValue(5000);

    const point = state.add(newPoint({ description: 'Text', preview: 'blob:p' }));

    expect(point).toEqual({
      id: expect.any(String),
      coords: { lng: 69.25, lat: 41.31 },
      title: 'New',
      description: 'Text',
      preview: 'blob:p',
      photos: [],
      createdAt: 5000,
      updatedAt: 5000,
    });
    expect(state.points).toHaveLength(1);
    expect(lastSaved()).toEqual([point]);
  });

  it('saves a plain snapshot, not the reactive proxy', () => {
    state.add(newPoint());

    const snapshot = lastSaved();

    expect(snapshot).not.toBe(state.points);
    expect(() => structuredClone(snapshot)).not.toThrow();
  });

  it('keeps an id created in advance (the photo folder already uses it)', () => {
    const id = createId();

    expect(state.add(newPoint({ id })).id).toBe(id);
  });

  it('replaces an invalid or an already used id', () => {
    const first = state.add(newPoint({ id: createId() }));

    expect(state.add(newPoint({ id: first.id })).id).not.toBe(first.id);
    expect(state.add(newPoint({ id: '../x' })).id).not.toBe('../x');
  });

  it('trims and cuts the texts to the limits', () => {
    const point = state.add(
      newPoint({
        title: `  ${'t'.repeat(LIMITS.title + 1)}  `,
        description: ` ${'d'.repeat(LIMITS.description + 1)}`,
      }),
    );

    expect(point.title).toHaveLength(LIMITS.title);
    expect(point.description).toHaveLength(LIMITS.description);
  });

  it('turns anything that is not text into an empty string', () => {
    const point = state.add(newPoint({ title: 42, description: null, preview: {} }));

    expect(point.title).toBe('');
    expect(point.description).toBe('');
    expect(point.preview).toBe('');
  });

  it('accepts only photos of the point itself', () => {
    const id = createId();
    const own = photoOf(id);

    const point = state.add(newPoint({ id, photos: [own, photoOf(createId()), '../x.jpg'] }));

    expect(point.photos).toEqual([own]);
  });

  it('copies the coordinates, not the caller object', () => {
    const coords = { lng: 1, lat: 2, extra: true };

    const point = state.add(newPoint({ coords }));
    coords.lng = 99;

    expect(point.coords).toEqual({ lng: 1, lat: 2 });
  });
});

describe('getById', () => {
  it('finds a point or returns null', async () => {
    const saved = storedPoint();
    await load({ status: 'ok', points: [saved] });

    expect(state.getById(saved.id)).toEqual(saved);
    expect(state.getById(createId())).toBeNull();
  });
});

describe('update', () => {
  let saved;

  beforeEach(async () => {
    saved = storedPoint({ title: 'Old', description: 'Old text', updatedAt: 1000 });
    await load({ status: 'ok', points: [saved] });
  });

  it('returns null and saves nothing for an unknown point', () => {
    expect(state.update(createId(), { title: 'X' })).toBeNull();
    expect(deps.schedule).not.toHaveBeenCalled();
  });

  it('changes the texts, moves updatedAt and saves', () => {
    vi.spyOn(Date, 'now').mockReturnValue(9000);

    const point = state.update(saved.id, { title: ' New ', description: 'New text' });

    expect(point.title).toBe('New');
    expect(point.description).toBe('New text');
    expect(point.updatedAt).toBe(9000);
    expect(lastSaved()[0].title).toBe('New');
  });

  it('the same text (after trimming) does not make the point newer', () => {
    vi.spyOn(Date, 'now').mockReturnValue(9000);

    expect(state.update(saved.id, { title: ' Old ' }).updatedAt).toBe(1000);
  });

  // The preview and the photos are local only: they never make an imported copy lose a merge
  it('the preview and the photos do not make the point newer, but are saved', () => {
    vi.spyOn(Date, 'now').mockReturnValue(9000);
    const photo = photoOf(saved.id);

    const point = state.update(saved.id, { preview: 'blob:p', photos: [photo] });

    expect(point.preview).toBe('blob:p');
    expect(point.photos).toEqual([photo]);
    expect(point.updatedAt).toBe(1000);
    expect(deps.schedule).toHaveBeenCalled();
  });

  it('updatedAt always moves forward, even if the clock went back', () => {
    vi.spyOn(Date, 'now').mockReturnValue(500);

    expect(state.update(saved.id, { title: 'New' }).updatedAt).toBe(1001);
  });

  it('cuts the title and keeps only photos of the point', () => {
    const point = state.update(saved.id, {
      title: 'x'.repeat(LIMITS.title + 5),
      photos: [photoOf(createId())],
    });

    expect(point.title).toHaveLength(LIMITS.title);
    expect(point.photos).toEqual([]);
  });

  it('fields that are not given stay as they are', () => {
    const point = state.update(saved.id, {});

    expect(point.title).toBe('Old');
    expect(point.description).toBe('Old text');
  });
});

describe('remove', () => {
  let saved;

  beforeEach(async () => {
    saved = storedPoint();
    await load({ status: 'ok', points: [saved, storedPoint()] });
  });

  it('removes the point, saves and deletes its photos', () => {
    state.remove(saved.id);

    expect(state.getById(saved.id)).toBeNull();
    expect(state.points).toHaveLength(1);
    expect(lastSaved()).toHaveLength(1);
    expect(deps.deletePointPhotos).toHaveBeenCalledWith(saved.id);
  });

  it('an unknown id changes nothing', () => {
    state.remove(createId());

    expect(state.points).toHaveLength(2);
    expect(deps.schedule).not.toHaveBeenCalled();
    expect(deps.deletePointPhotos).not.toHaveBeenCalled();
  });

  it('a failed photo delete is swallowed (the startup check cleans up later)', async () => {
    deps.deletePointPhotos = vi.fn(async () => {
      throw new Error('Disk error');
    });

    expect(() => state.remove(saved.id)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe('flush and initCustomPointsPersistence', () => {
  beforeEach(() => load());

  it('flush writes through the storage', async () => {
    await state.flush();

    expect(deps.flush).toHaveBeenCalledTimes(1);
  });

  it('saves at once when the app goes to the background', () => {
    module.initCustomPointsPersistence();
    const [goingToBackground] = deps.onAppBackground.mock.lastCall;

    expect(deps.flush).not.toHaveBeenCalled();
    goingToBackground();
    expect(deps.flush).toHaveBeenCalledTimes(1);
  });

  it('binds the listener only once', () => {
    module.initCustomPointsPersistence();
    module.initCustomPointsPersistence();

    expect(deps.onAppBackground).toHaveBeenCalledTimes(1);
  });
});

describe('export and import', () => {
  it('exports every point, shared fields only', async () => {
    const withPhoto = storedPoint({ title: 'With photo' });
    withPhoto.photos = [photoOf(withPhoto.id)];
    withPhoto.preview = 'local preview';
    await load({ status: 'ok', points: [storedPoint(), withPhoto] });

    const { text, count } = await state.exportFile();
    const data = JSON.parse(text);

    expect(count).toBe(2);
    expect(data.points.map((point) => point.id)).toEqual(state.points.map((point) => point.id));
    expect(data.points[1]).not.toHaveProperty('photos');
    expect(data.points[1]).not.toHaveProperty('preview');
  });

  it('an export waits for the saved points', async () => {
    let finishLoading;
    deps.load = vi.fn(() => new Promise((resolve) => (finishLoading = resolve)));
    vi.resetModules();
    module = await import('@/lib/state/customPointsState.svelte.js');
    state = module.customPointsState;

    const exporting = state.exportFile();
    finishLoading({ status: 'ok', points: [storedPoint()] });

    expect((await exporting).count).toBe(1);
  });

  it('imports new points, updates older ones, keeps local photos, and saves at once', async () => {
    const kept = storedPoint({ title: 'Device', updatedAt: 1000 });
    kept.photos = [photoOf(kept.id)];
    await load({ status: 'ok', points: [kept] });

    const fresher = { ...kept, title: 'From the file', updatedAt: 2000 };
    const added = storedPoint({ title: 'New one' });
    const result = await state.importFile(buildExportFile([fresher, added]));

    expect(result).toEqual({ ok: true, added: 1, updated: 1, unchanged: 0, skipped: 0 });
    expect(state.points.map((point) => point.title)).toEqual(['From the file', 'New one']);
    expect(state.points[0].photos).toEqual(kept.photos);
    expect(lastSaved()).toHaveLength(2);
    expect(deps.flush).toHaveBeenCalledTimes(1);
  });

  it('a preview counts what an import would do and changes nothing', async () => {
    const kept = storedPoint({ title: 'Device', updatedAt: 1000 });
    const older = storedPoint({ title: 'Newer here', updatedAt: 9000 });
    await load({ status: 'ok', points: [kept, older] });

    const text = buildExportFile([
      { ...kept, title: 'From the file', updatedAt: 2000 },
      { ...older, title: 'Older there', updatedAt: 1 },
      storedPoint({ title: 'New one' }),
      storedPoint({ title: '' }),
    ]);
    const preview = await state.previewImport(text);

    expect(preview).toEqual({ ok: true, added: 1, updated: 1, unchanged: 1, skipped: 1 });
    expect(state.points.map((point) => point.title)).toEqual(['Device', 'Newer here']);
    expect(deps.schedule).not.toHaveBeenCalled();
    expect(deps.flush).not.toHaveBeenCalled();

    // The import itself does what the preview said
    expect(await state.importFile(text)).toEqual(preview);
  });

  it('a preview refuses a bad file like the import does', async () => {
    await load({ status: 'ok' });

    expect(await state.previewImport('not json')).toEqual({ ok: false, reason: 'invalidJson' });
  });

  it('an import that changes nothing saves nothing', async () => {
    const point = storedPoint({ updatedAt: 5000 });
    await load({ status: 'ok', points: [point] });

    const result = await state.importFile(buildExportFile([{ ...point, title: 'Older', updatedAt: 4000 }]));

    expect(result).toEqual({ ok: true, added: 0, updated: 0, unchanged: 1, skipped: 0 });
    expect(state.points[0].title).toBe(point.title);
    expect(deps.schedule).not.toHaveBeenCalled();
    expect(deps.flush).not.toHaveBeenCalled();
  });

  it('counts broken entries of the file as skipped', async () => {
    await load({ status: 'ok' });
    const text = buildExportFile([storedPoint({ title: 'Good' }), storedPoint({ title: '' })]);

    const result = await state.importFile(text);

    expect(result).toMatchObject({ ok: true, added: 1, skipped: 1 });
  });

  it.each([
    ['not JSON at all', 'not json', 'invalidJson'],
    ['another format', JSON.stringify({ format: 'something', points: [] }), 'unknownFormat'],
  ])('refuses %s and changes nothing', async (_name, text, reason) => {
    await load({ status: 'ok', points: [storedPoint()] });

    const result = await state.importFile(text);

    expect(result).toEqual({ ok: false, reason });
    expect(state.points).toHaveLength(1);
    expect(deps.schedule).not.toHaveBeenCalled();
  });

  it('a file edited by hand after the export is refused as a whole', async () => {
    await load({ status: 'ok' });
    const outside = storedPoint();
    const text = JSON.stringify({
      ...JSON.parse(buildExportFile([outside])),
    }).replace('"createdAt"', `"photos":["${photoOf(outside.id)}"],"preview":"x","createdAt"`);

    const result = await state.importFile(text);

    // Smuggled-in local fields break the checksum (local fields themselves: customPointsFormat.test.js)
    expect(result).toEqual({ ok: false, reason: 'checksumMismatch' });
  });
});
