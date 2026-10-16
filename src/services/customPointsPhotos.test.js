import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Directory } from '@capacitor/filesystem';
import { createId } from '@/utils/uuid';

// Every Filesystem method is a recorder that calls the real web implementation (IndexedDB from
// fake-indexeddb) by default. A test overrides one call (`...Once`) to simulate native-only behavior.
vi.mock('@capacitor/filesystem', async (importOriginal) => {
  const actual = await importOriginal();
  const methods = ['readFile', 'writeFile', 'readdir', 'mkdir', 'deleteFile', 'rmdir', 'copy', 'getUri'];
  const Filesystem = Object.fromEntries(
    methods.map((name) => [name, vi.fn((...args) => actual.Filesystem[name](...args))]),
  );

  return { ...actual, Filesystem };
});

// jsdom has no canvas: the resize itself is covered by utils/imageResize.test.js
vi.mock('@/utils/imageResize', () => ({
  downscaleImage: vi.fn(async () => new Blob(['small'], { type: 'image/jpeg' })),
}));

const nativeError = (code, message = 'native error') => Object.assign(new Error(message), { code });

// The module keeps caches at module level (created folders, protected ids, Blob urls):
// every test works with a fresh copy, on the platform it asks for. The Filesystem recorders
// survive vi.resetModules(), so tests only use the `...Once` overrides.
let photos;
let Filesystem;
let Capacitor;
let downscaleImage;

async function load({ native = false } = {}) {
  vi.resetModules();

  ({ Capacitor } = await import('@capacitor/core'));
  ({ Filesystem } = await import('@capacitor/filesystem'));
  ({ downscaleImage } = await import('@/utils/imageResize'));

  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(native);
  vi.spyOn(Capacitor, 'convertFileSrc').mockImplementation((uri) => `converted:${uri}`);

  photos = await import('@/services/customPointsPhotos');

  // Only the calls of the test itself are interesting
  Object.values(Filesystem).forEach((fn) => fn.mockClear());
  downscaleImage.mockClear();
}

// A file written straight through the plugin, as if an earlier session had saved it
async function putFile(path) {
  await Filesystem.writeFile({ path, data: btoa('photo'), directory: Directory.Data, recursive: true });
}

async function exists(path) {
  try {
    await Filesystem.readFile({ path, directory: Directory.Data });
    return true;
  } catch {
    return false;
  }
}

const photoPath = (pointId, extension = 'jpg') => `photos/${pointId}/${createId()}.${extension}`;

let sourceBlob;
let urlCounter;

beforeEach(async () => {
  await load();

  // fake-indexeddb is shared by the whole file: start every test with no photos at all
  await Filesystem.rmdir({ path: 'photos', directory: Directory.Data, recursive: true }).catch(() => {});
  Filesystem.rmdir.mockClear();

  sourceBlob = new Blob(['camera bytes'], { type: 'image/jpeg' });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ blob: async () => sourceBlob })),
  );

  // jsdom has no Blob urls
  urlCounter = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${(urlCounter += 1)}`);
  URL.revokeObjectURL = vi.fn();
});

describe('savePhoto — validation', () => {
  it('rejects an invalid point id without touching the disk', async () => {
    for (const pointId of ['', '..', 'not-a-uuid', '../etc', null, undefined]) {
      await expect(photos.savePhoto({ pointId, source: { webPath: 'blob:x' } })).rejects.toThrow('Invalid point id');
    }

    expect(Filesystem.writeFile).not.toHaveBeenCalled();
  });

  it('rejects an unsupported extension', async () => {
    await expect(
      photos.savePhoto({ pointId: createId(), source: { webPath: 'blob:x' }, extension: 'exe' }),
    ).rejects.toThrow('Unsupported photo extension');

    expect(Filesystem.writeFile).not.toHaveBeenCalled();
  });
});

describe('savePhoto — web', () => {
  it('reads the webPath and writes the Blob to photos/<point id>/<uuid>.jpg', async () => {
    const pointId = createId();
    const path = await photos.savePhoto({ pointId, source: { webPath: 'blob:picked' } });

    expect(path).toMatch(new RegExp(`^photos/${pointId}/[0-9a-f-]{36}\\.jpg$`));
    expect(fetch).toHaveBeenCalledWith('blob:picked');
    expect(Filesystem.writeFile).toHaveBeenCalledWith({
      path,
      data: sourceBlob,
      directory: Directory.Data,
      recursive: true,
    });
    expect(Filesystem.copy).not.toHaveBeenCalled();
  });

  it('every photo gets its own path', async () => {
    const pointId = createId();
    const first = await photos.savePhoto({ pointId, source: { webPath: 'blob:a' } });
    const second = await photos.savePhoto({ pointId, source: { webPath: 'blob:b' } });

    expect(first).not.toBe(second);
  });

  it('keeps a supported extension', async () => {
    const path = await photos.savePhoto({ pointId: createId(), source: { webPath: 'blob:x' }, extension: 'png' });

    expect(path.endsWith('.png')).toBe(true);
  });

  it('downscales before writing when asked to', async () => {
    const resize = { maxSide: 1280, quality: 80 };

    await photos.savePhoto({ pointId: createId(), source: { webPath: 'blob:x' }, resize });

    expect(downscaleImage).toHaveBeenCalledWith(sourceBlob, resize);
    expect(Filesystem.writeFile.mock.calls[0][0].data).toBe(await downscaleImage.mock.results[0].value);
  });

  it('does not downscale without a resize option', async () => {
    await photos.savePhoto({ pointId: createId(), source: { webPath: 'blob:x' } });

    expect(downscaleImage).not.toHaveBeenCalled();
  });

  it('throws when the source has no webPath', async () => {
    await expect(photos.savePhoto({ pointId: createId(), source: { uri: 'file:///x.jpg' } })).rejects.toThrow(
      'no webPath',
    );
    await expect(photos.savePhoto({ pointId: createId(), source: null })).rejects.toThrow('no webPath');
  });

  it('throws when the file could not be written', async () => {
    Filesystem.writeFile.mockRejectedValueOnce(new Error('Quota exceeded'));

    await expect(photos.savePhoto({ pointId: createId(), source: { webPath: 'blob:x' } })).rejects.toThrow(
      'Failed to write',
    );
  });
});

describe('savePhoto — device', () => {
  beforeEach(async () => {
    await load({ native: true });
  });

  it('creates the folder and copies natively: no bytes through the bridge', async () => {
    const pointId = createId();
    Filesystem.copy.mockResolvedValueOnce({ uri: 'file:///data/x.jpg' });

    const path = await photos.savePhoto({ pointId, source: { uri: 'file:///cache/picked.jpg', webPath: 'x' } });

    expect(Filesystem.mkdir).toHaveBeenCalledWith({
      path: `photos/${pointId}`,
      directory: Directory.Data,
      recursive: true,
    });
    expect(Filesystem.copy).toHaveBeenCalledWith({
      from: 'file:///cache/picked.jpg',
      to: path,
      toDirectory: Directory.Data,
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(Filesystem.writeFile).not.toHaveBeenCalled();
  });

  it('creates the folder of a point only once per session (one bridge call less per photo)', async () => {
    const pointId = createId();
    Filesystem.copy
      .mockResolvedValueOnce({ uri: 'file:///data/x.jpg' })
      .mockResolvedValueOnce({ uri: 'file:///data/y.jpg' });

    await photos.savePhoto({ pointId, source: { uri: 'file:///a.jpg' } });
    await photos.savePhoto({ pointId, source: { uri: 'file:///b.jpg' } });

    expect(Filesystem.mkdir).toHaveBeenCalledTimes(1);
  });

  it('creates the folder again after the photos of the point were deleted', async () => {
    const pointId = createId();
    Filesystem.copy
      .mockResolvedValueOnce({ uri: 'file:///data/x.jpg' })
      .mockResolvedValueOnce({ uri: 'file:///data/y.jpg' });

    await photos.savePhoto({ pointId, source: { uri: 'file:///a.jpg' } });
    await photos.deletePointPhotos(pointId);
    await photos.savePhoto({ pointId, source: { uri: 'file:///b.jpg' } });

    expect(Filesystem.mkdir).toHaveBeenCalledTimes(2);
  });

  it('accepts a folder that already exists (native code)', async () => {
    Filesystem.mkdir.mockRejectedValueOnce(nativeError('OS-PLUG-FILE-0010', 'already exists'));
    Filesystem.copy.mockResolvedValueOnce({ uri: 'file:///data/x.jpg' });

    await expect(photos.savePhoto({ pointId: createId(), source: { uri: 'file:///a.jpg' } })).resolves.toBeTruthy();
  });

  it('throws and copies nothing when the folder could not be created', async () => {
    Filesystem.mkdir.mockRejectedValueOnce(nativeError('OS-PLUG-FILE-0005', 'Permission denied'));

    await expect(photos.savePhoto({ pointId: createId(), source: { uri: 'file:///a.jpg' } })).rejects.toThrow(
      'Failed to create',
    );
    expect(Filesystem.copy).not.toHaveBeenCalled();
  });

  it('falls back to base64 when the native copy fails', async () => {
    Filesystem.copy.mockRejectedValueOnce(new Error('copy failed'));

    const path = await photos.savePhoto({ pointId: createId(), source: { uri: 'file:///a.jpg', webPath: 'blob:a' } });

    expect(fetch).toHaveBeenCalledWith('blob:a');
    expect(Filesystem.writeFile).toHaveBeenCalledWith({
      path,
      data: btoa('camera bytes'),
      directory: Directory.Data,
      recursive: true,
    });
    expect(await exists(path)).toBe(true);
  });

  it('goes straight to the fallback when the source has no uri', async () => {
    await photos.savePhoto({ pointId: createId(), source: { webPath: 'blob:a' } });

    expect(Filesystem.copy).not.toHaveBeenCalled();
    expect(Filesystem.writeFile).toHaveBeenCalledTimes(1);
  });

  it('never resizes on a device (the Camera plugin did it)', async () => {
    await photos.savePhoto({ pointId: createId(), source: { webPath: 'blob:a' }, resize: { maxSide: 1, quality: 1 } });

    expect(downscaleImage).not.toHaveBeenCalled();
  });

  it('throws when both the copy and the fallback write fail', async () => {
    Filesystem.copy.mockRejectedValueOnce(new Error('copy failed'));
    Filesystem.writeFile.mockRejectedValueOnce(new Error('Disk full'));

    await expect(
      photos.savePhoto({ pointId: createId(), source: { uri: 'file:///a.jpg', webPath: 'blob:a' } }),
    ).rejects.toThrow('Failed to write');
  });

  it('throws when the copy fails and there is no webPath to fall back to', async () => {
    Filesystem.copy.mockRejectedValueOnce(new Error('copy failed'));

    await expect(photos.savePhoto({ pointId: createId(), source: { uri: 'file:///a.jpg' } })).rejects.toThrow(
      'no webPath',
    );
  });
});

describe('deletePhotoFiles', () => {
  it('deletes the given photo files', async () => {
    const pointId = createId();
    const kept = photoPath(pointId);
    const removed = photoPath(pointId);
    await putFile(kept);
    await putFile(removed);

    await photos.deletePhotoFiles([removed]);

    expect(await exists(removed)).toBe(false);
    expect(await exists(kept)).toBe(true);
  });

  it('ignores anything that is not a photo path', async () => {
    const pointId = createId();
    const hostile = [
      '../secrets.json',
      `photos/${pointId}/../../custom-points-a.json`,
      `photos/${pointId}/${createId()}.exe`,
      `photos/not-a-uuid/${createId()}.jpg`,
      `photos/${pointId}`,
      'custom-points-a.json',
      null,
      42,
    ];

    await photos.deletePhotoFiles(hostile);

    expect(Filesystem.deleteFile).not.toHaveBeenCalled();
  });

  it('a file that is already gone is fine', async () => {
    await expect(photos.deletePhotoFiles([photoPath(createId())])).resolves.toBeUndefined();
  });
});

describe('deletePointPhotos', () => {
  it('removes the whole folder of the point and nothing else', async () => {
    const pointId = createId();
    const other = photoPath(createId());
    await putFile(photoPath(pointId));
    await putFile(other);

    await photos.deletePointPhotos(pointId);

    expect(Filesystem.rmdir).toHaveBeenCalledWith({
      path: `photos/${pointId}`,
      directory: Directory.Data,
      recursive: true,
    });
    expect(await photos.pruneUnreferenced(pointId, [])).toBe(0);
    expect(await exists(other)).toBe(true);
  });

  it('ignores an invalid id (never removes photos/ or anything above it)', async () => {
    for (const pointId of ['', '..', '../..', 'x', null]) {
      await photos.deletePointPhotos(pointId);
    }

    expect(Filesystem.rmdir).not.toHaveBeenCalled();
  });
});

describe('pruneUnreferenced', () => {
  it('deletes only the files that are not in the keep list (one listing)', async () => {
    const pointId = createId();
    const keep = photoPath(pointId);
    const extraA = photoPath(pointId);
    const extraB = photoPath(pointId, 'png');
    await putFile(keep);
    await putFile(extraA);
    await putFile(extraB);

    expect(await photos.pruneUnreferenced(pointId, [keep])).toBe(2);
    expect(Filesystem.readdir).toHaveBeenCalledTimes(1);
    expect(await exists(keep)).toBe(true);
    expect(await exists(extraA)).toBe(false);
    expect(await exists(extraB)).toBe(false);
  });

  it('leaves subdirectories alone', async () => {
    const pointId = createId();
    await putFile(`photos/${pointId}/nested/x.jpg`);

    expect(await photos.pruneUnreferenced(pointId, [])).toBe(0);
    expect(await exists(`photos/${pointId}/nested/x.jpg`)).toBe(true);
  });

  it('returns 0 for a point without a folder', async () => {
    expect(await photos.pruneUnreferenced(createId(), [])).toBe(0);
  });

  it('returns 0 and touches nothing for an invalid id', async () => {
    expect(await photos.pruneUnreferenced('..', [])).toBe(0);
    expect(Filesystem.readdir).not.toHaveBeenCalled();
  });

  // An unreadable folder must not look like an empty one
  it('deletes nothing when the folder could not be listed', async () => {
    const pointId = createId();
    await putFile(photoPath(pointId));
    Filesystem.readdir.mockRejectedValueOnce(nativeError('OS-PLUG-FILE-0005', 'Permission denied'));

    expect(await photos.pruneUnreferenced(pointId, [])).toBe(0);
    expect(Filesystem.deleteFile).not.toHaveBeenCalled();
  });
});

describe('reconcilePhotos', () => {
  it('removes orphan folders and stray files, keeps the folders of known points', async () => {
    const known = createId();
    const orphan = createId();
    await putFile(photoPath(known));
    await putFile(photoPath(orphan));
    await putFile('photos/stray.tmp');

    const result = await photos.reconcilePhotos([{ id: known, photos: [] }]);

    expect(result.removedOrphans).toBe(2);
    expect(await photos.pruneUnreferenced(known, [])).toBe(1);
    expect(Filesystem.rmdir).toHaveBeenCalledWith(expect.objectContaining({ path: `photos/${orphan}` }));
    expect(Filesystem.deleteFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'photos/stray.tmp' }));
  });

  it('lists the photos folder exactly once', async () => {
    await photos.reconcilePhotos([{ id: createId(), photos: [] }]);

    expect(Filesystem.readdir).toHaveBeenCalledTimes(1);
  });

  it('reports the points that have photo paths but no folder', async () => {
    const withFolder = createId();
    const withoutFolder = createId();
    const withoutPhotos = createId();
    await putFile(photoPath(withFolder));

    const result = await photos.reconcilePhotos([
      { id: withFolder, photos: [photoPath(withFolder)] },
      { id: withoutFolder, photos: [photoPath(withoutFolder)] },
      { id: withoutPhotos, photos: [] },
    ]);

    expect(result).toEqual({ removedOrphans: 0, pointsWithoutFolder: [withoutFolder] });
  });

  it('works when the photos folder does not exist yet', async () => {
    const id = createId();

    expect(await photos.reconcilePhotos([{ id, photos: [photoPath(id)] }])).toEqual({
      removedOrphans: 0,
      pointsWithoutFolder: [id],
    });
  });

  // A point that is being created right now is not in the saved list yet
  it('never removes the folder of a point that got photos in this session', async () => {
    const unsaved = createId();
    const path = await photos.savePhoto({ pointId: unsaved, source: { webPath: 'blob:x' } });

    const result = await photos.reconcilePhotos([]);

    expect(result.removedOrphans).toBe(0);
    expect(Filesystem.rmdir).not.toHaveBeenCalled();
    expect(Filesystem.readdir).toHaveBeenCalledTimes(1);
    expect(path.startsWith(`photos/${unsaved}/`)).toBe(true);
  });

  it('a point whose photos were deleted is no longer protected', async () => {
    const pointId = createId();
    await photos.savePhoto({ pointId, source: { webPath: 'blob:x' } });
    await photos.deletePointPhotos(pointId);
    await putFile(photoPath(pointId));

    expect((await photos.reconcilePhotos([])).removedOrphans).toBe(1);
  });

  it('throws and deletes nothing when the folder could not be listed', async () => {
    await putFile(photoPath(createId()));
    Filesystem.readdir.mockRejectedValueOnce(nativeError('OS-PLUG-FILE-0005', 'Permission denied'));

    await expect(photos.reconcilePhotos([])).rejects.toThrow('Permission denied');
    expect(Filesystem.rmdir).not.toHaveBeenCalled();
    expect(Filesystem.deleteFile).not.toHaveBeenCalled();
  });
});

describe('getPhotoUrl — device', () => {
  beforeEach(async () => {
    await load({ native: true });
    Filesystem.getUri.mockResolvedValueOnce({ uri: 'file:///data/files/' });
  });

  it('converts the file uri for the WebView', async () => {
    const path = photoPath(createId());

    expect(await photos.getPhotoUrl(path)).toBe(`converted:file:///data/files/${path}`);
    expect(Filesystem.readFile).not.toHaveBeenCalled();
  });

  it('asks for the data directory uri only once', async () => {
    await photos.getPhotoUrl(photoPath(createId()));
    await photos.getPhotoUrl(photoPath(createId()));

    expect(Filesystem.getUri).toHaveBeenCalledTimes(1);
  });
});

describe('getPhotoUrl / releasePhotoUrl — web', () => {
  // fake-indexeddb clones a jsdom Blob into a plain object, so the plugin's read result is set directly
  function mockRead(data) {
    Filesystem.readFile.mockResolvedValueOnce({ data });
  }

  it('returns null for anything that is not a photo path, without reading', async () => {
    for (const path of ['../x.jpg', 'photos/x/y.jpg', null]) {
      expect(await photos.getPhotoUrl(path)).toBeNull();
    }

    expect(Filesystem.readFile).not.toHaveBeenCalled();
  });

  it('creates one Blob url and shares it between users of the same photo', async () => {
    const path = photoPath(createId());
    mockRead(new Blob(['x']));

    const [first, second] = await Promise.all([photos.getPhotoUrl(path), photos.getPhotoUrl(path)]);

    expect(first).toBe('blob:test/1');
    expect(second).toBe(first);
    expect(Filesystem.readFile).toHaveBeenCalledTimes(1);
  });

  it('revokes the url only when the last user released it', async () => {
    const path = photoPath(createId());
    mockRead(new Blob(['x']));
    await photos.getPhotoUrl(path);
    await photos.getPhotoUrl(path);

    await photos.releasePhotoUrl(path);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    await photos.releasePhotoUrl(path);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });

  it('creates a new url after the old one was revoked', async () => {
    const path = photoPath(createId());
    mockRead(new Blob(['x']));
    await photos.getPhotoUrl(path);
    await photos.releasePhotoUrl(path);

    mockRead(new Blob(['x']));

    expect(await photos.getPhotoUrl(path)).toBe('blob:test/2');
  });

  it('an extra release does nothing', async () => {
    const path = photoPath(createId());
    mockRead(new Blob(['x']));
    await photos.getPhotoUrl(path);
    await photos.releasePhotoUrl(path);

    await photos.releasePhotoUrl(path);
    await photos.releasePhotoUrl(photoPath(createId()));

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it('returns null for a missing file and does not remember it', async () => {
    const path = photoPath(createId());

    expect(await photos.getPhotoUrl(path)).toBeNull();

    mockRead(new Blob(['x']));
    expect(await photos.getPhotoUrl(path)).toBe('blob:test/1');
  });

  it('rejects on a read error and does not remember the failure', async () => {
    const path = photoPath(createId());
    Filesystem.readFile.mockRejectedValueOnce(new Error('Permission denied'));

    await expect(photos.getPhotoUrl(path)).rejects.toThrow('Permission denied');
    await expect(photos.releasePhotoUrl(path)).resolves.toBeUndefined();

    mockRead(new Blob(['x']));
    expect(await photos.getPhotoUrl(path)).toBe('blob:test/1');
  });

  it('deletePhotoFiles releases the url of a deleted photo', async () => {
    const path = photoPath(createId());
    mockRead(new Blob(['x']));
    await photos.getPhotoUrl(path);

    await photos.deletePhotoFiles([path]);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });

  it('deletePointPhotos releases the urls of that point only', async () => {
    const pointId = createId();
    const own = photoPath(pointId);
    const foreign = photoPath(createId());
    mockRead(new Blob(['own']));
    await photos.getPhotoUrl(own);
    mockRead(new Blob(['foreign']));
    await photos.getPhotoUrl(foreign);

    await photos.deletePointPhotos(pointId);
    await Promise.resolve();

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
  });
});
