import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PHOTO_SIZE, PhotoPickerError, chooseFromGallery, takePhoto } from '@/capacitor/services/photoPicker';
import { LIMITS } from '@/services/customPointsFormat';
import { deletePhotoFiles, deletePointPhotos, pruneUnreferenced, savePhoto } from '@/services/customPointsPhotos';
import { createPhotoSession } from '@/lib/state/photoSession.svelte.js';

// The picker and the photo files are recorders: the session is only about which photos belong to
// the form and which files must go when it ends. The real file work is covered by customPointsPhotos.test.js.
vi.mock('@/capacitor/services/photoPicker', async (importOriginal) => {
  const actual = await importOriginal();

  return { ...actual, takePhoto: vi.fn(), chooseFromGallery: vi.fn() };
});

vi.mock('@/services/customPointsPhotos', () => ({
  savePhoto: vi.fn(),
  deletePhotoFiles: vi.fn(),
  deletePointPhotos: vi.fn(),
  pruneUnreferenced: vi.fn(),
}));

const POINT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const ORIGINAL = `photos/${POINT_ID}/original.jpg`;

const sources = (count) => Array.from({ length: count }, (_, index) => ({ uri: `file:///picked/${index}.jpg` }));

// A promise the test resolves itself: lets it act while a pick or a save is still running
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

let session;
let savedCount;

beforeEach(() => {
  // vi.fn()s created inside vi.mock are not reset by restoreMocks
  vi.mocked(takePhoto).mockReset();
  vi.mocked(chooseFromGallery).mockReset();
  vi.mocked(savePhoto).mockReset();
  vi.mocked(deletePhotoFiles).mockReset().mockResolvedValue(undefined);
  vi.mocked(deletePointPhotos).mockReset().mockResolvedValue(undefined);
  vi.mocked(pruneUnreferenced).mockReset().mockResolvedValue(0);

  savedCount = 0;
  vi.mocked(savePhoto).mockImplementation(async ({ pointId }) => {
    savedCount += 1;
    return `photos/${pointId}/saved-${savedCount}.jpg`;
  });

  session = createPhotoSession();
});

describe('before begin', () => {
  it('has no point, no photos and can not add', async () => {
    expect(session.pointId).toBeNull();
    expect(session.photos).toEqual([]);
    expect(session.isBusy).toBe(false);
    expect(session.canAdd).toBe(false);
    expect(session.freeSlots).toBe(LIMITS.maxPhotos);

    expect(await session.add('camera')).toEqual({ status: 'busy', added: 0 });
    expect(takePhoto).not.toHaveBeenCalled();
  });

  it('commit and discard do nothing', async () => {
    await session.commit();
    await session.discard();

    expect(pruneUnreferenced).not.toHaveBeenCalled();
    expect(deletePointPhotos).not.toHaveBeenCalled();
    expect(deletePhotoFiles).not.toHaveBeenCalled();
  });
});

describe('begin', () => {
  it('takes a copy of the photos of the point', () => {
    const list = [ORIGINAL];

    session.begin({ pointId: POINT_ID, photos: list, isNew: false });
    list.push('changed outside');

    expect(session.pointId).toBe(POINT_ID);
    expect(session.photos).toEqual([ORIGINAL]);
    expect(session.freeSlots).toBe(LIMITS.maxPhotos - 1);
    expect(session.canAdd).toBe(true);
  });

  it('is full when the point already has the maximum of photos', () => {
    const full = Array.from({ length: LIMITS.maxPhotos }, (_, index) => `photos/${POINT_ID}/${index}.jpg`);

    session.begin({ pointId: POINT_ID, photos: full, isNew: false });

    expect(session.canAdd).toBe(false);
    expect(session.freeSlots).toBe(0);
  });

  // A form that was not finished: its unsaved photos are not needed any more
  it('discards an unfinished session of a new point (the whole folder)', () => {
    session.begin({ pointId: POINT_ID, photos: [], isNew: true });
    session.begin({ pointId: OTHER_ID, photos: [], isNew: false });

    expect(deletePointPhotos).toHaveBeenCalledWith(POINT_ID);
    expect(session.pointId).toBe(OTHER_ID);
  });
});

describe('add', () => {
  beforeEach(() => {
    session.begin({ pointId: POINT_ID, photos: [ORIGINAL], isNew: false });
  });

  it('saves a camera photo into the folder of the point with the shared photo size', async () => {
    const [source] = sources(1);
    vi.mocked(takePhoto).mockResolvedValueOnce([source]);

    expect(await session.add('camera')).toEqual({ status: 'ok', added: 1 });
    expect(savePhoto).toHaveBeenCalledWith({ pointId: POINT_ID, source, resize: PHOTO_SIZE });
    expect(session.photos).toEqual([ORIGINAL, `photos/${POINT_ID}/saved-1.jpg`]);
    expect(chooseFromGallery).not.toHaveBeenCalled();
  });

  it('asks the gallery for no more photos than there is room for', async () => {
    vi.mocked(chooseFromGallery).mockResolvedValueOnce(sources(2));

    expect(await session.add('gallery')).toEqual({ status: 'ok', added: 2 });
    expect(chooseFromGallery).toHaveBeenCalledWith(LIMITS.maxPhotos - 1);
    expect(session.photos).toHaveLength(3);
  });

  it('ignores the photos that do not fit and says so', async () => {
    const free = LIMITS.maxPhotos - 1;
    vi.mocked(chooseFromGallery).mockResolvedValueOnce(sources(free + 2));

    expect(await session.add('gallery')).toEqual({ status: 'truncated', added: free });
    expect(savePhoto).toHaveBeenCalledTimes(free);
    expect(session.photos).toHaveLength(LIMITS.maxPhotos);
    expect(session.canAdd).toBe(false);
  });

  it('exactly the free number of photos is not truncated', async () => {
    vi.mocked(chooseFromGallery).mockResolvedValueOnce(sources(LIMITS.maxPhotos - 1));

    expect(await session.add('gallery')).toEqual({ status: 'ok', added: LIMITS.maxPhotos - 1 });
  });

  it('reports a cancelled pick', async () => {
    vi.mocked(takePhoto).mockResolvedValueOnce([]);

    expect(await session.add('camera')).toEqual({ status: 'cancelled', added: 0 });
    expect(savePhoto).not.toHaveBeenCalled();
  });

  it('does not open the picker when the list is full', async () => {
    vi.mocked(chooseFromGallery).mockResolvedValueOnce(sources(LIMITS.maxPhotos));
    await session.add('gallery');

    expect(await session.add('camera')).toEqual({ status: 'limit', added: 0 });
    expect(takePhoto).not.toHaveBeenCalled();
  });

  it('is busy while adding and refuses a second add at the same time', async () => {
    const pick = deferred();
    vi.mocked(takePhoto).mockReturnValueOnce(pick.promise);

    const first = session.add('camera');

    expect(session.isBusy).toBe(true);
    expect(session.canAdd).toBe(false);
    expect(await session.add('camera')).toEqual({ status: 'busy', added: 0 });

    pick.resolve(sources(1));

    expect(await first).toEqual({ status: 'ok', added: 1 });
    expect(session.isBusy).toBe(false);
    expect(takePhoto).toHaveBeenCalledTimes(1);
  });

  it('reports a denied permission and is not busy afterwards', async () => {
    vi.mocked(takePhoto).mockRejectedValueOnce(new PhotoPickerError('denied', new Error('no')));

    expect(await session.add('camera')).toEqual({ status: 'denied', added: 0 });
    expect(session.isBusy).toBe(false);
  });

  it('reports any other error as failed', async () => {
    vi.mocked(takePhoto).mockRejectedValueOnce(new Error('bridge down'));

    expect(await session.add('camera')).toEqual({ status: 'failed', added: 0 });
  });

  it('keeps the photos saved before a save failed', async () => {
    vi.mocked(chooseFromGallery).mockResolvedValueOnce(sources(3));
    vi.mocked(savePhoto)
      .mockResolvedValueOnce(`photos/${POINT_ID}/first.jpg`)
      .mockRejectedValueOnce(new Error('Disk full'));

    expect(await session.add('gallery')).toEqual({ status: 'failed', added: 1 });
    expect(session.photos).toEqual([ORIGINAL, `photos/${POINT_ID}/first.jpg`]);
    expect(savePhoto).toHaveBeenCalledTimes(2);
  });

  it('saves nothing when the form was closed while the picker was open', async () => {
    const pick = deferred();
    vi.mocked(takePhoto).mockReturnValueOnce(pick.promise);

    const result = session.add('camera');
    session.end();
    pick.resolve(sources(1));

    expect(await result).toEqual({ status: 'cancelled', added: 0 });
    expect(savePhoto).not.toHaveBeenCalled();
  });

  it('deletes a photo that finished saving after the form was closed', async () => {
    const save = deferred();
    vi.mocked(takePhoto).mockResolvedValueOnce(sources(1));
    vi.mocked(savePhoto).mockReturnValueOnce(save.promise);

    const result = session.add('camera');
    await vi.waitFor(() => expect(savePhoto).toHaveBeenCalled());
    session.end();
    save.resolve(`photos/${POINT_ID}/late.jpg`);

    expect(await result).toEqual({ status: 'cancelled', added: 0 });
    expect(deletePhotoFiles).toHaveBeenCalledWith([`photos/${POINT_ID}/late.jpg`]);
  });

  it('a late photo of the old form never lands in a new one', async () => {
    const save = deferred();
    vi.mocked(takePhoto).mockResolvedValueOnce(sources(1));
    vi.mocked(savePhoto).mockReturnValueOnce(save.promise);

    const result = session.add('camera');
    await vi.waitFor(() => expect(savePhoto).toHaveBeenCalled());
    session.begin({ pointId: OTHER_ID, photos: [], isNew: false });
    save.resolve(`photos/${POINT_ID}/late.jpg`);
    await result;

    expect(session.pointId).toBe(OTHER_ID);
    expect(session.photos).toEqual([]);
    await session.discard();
    expect(deletePhotoFiles).toHaveBeenCalledTimes(1);
  });

  it('a failed delete of a late photo is swallowed', async () => {
    const save = deferred();
    vi.mocked(takePhoto).mockResolvedValueOnce(sources(1));
    vi.mocked(savePhoto).mockReturnValueOnce(save.promise);
    vi.mocked(deletePhotoFiles).mockRejectedValueOnce(new Error('Disk error'));

    const result = session.add('camera');
    await vi.waitFor(() => expect(savePhoto).toHaveBeenCalled());
    session.end();
    save.resolve(`photos/${POINT_ID}/late.jpg`);

    expect(await result).toEqual({ status: 'cancelled', added: 0 });
  });
});

describe('remove', () => {
  beforeEach(async () => {
    session.begin({ pointId: POINT_ID, photos: [ORIGINAL], isNew: false });
    vi.mocked(takePhoto).mockResolvedValueOnce(sources(1));
    await session.add('camera');
  });

  it('deletes a photo added in this session at once', () => {
    const added = `photos/${POINT_ID}/saved-1.jpg`;

    session.remove(added);

    expect(session.photos).toEqual([ORIGINAL]);
    expect(deletePhotoFiles).toHaveBeenCalledWith([added]);
  });

  // A cancel must be able to bring an original photo back
  it('keeps the file of an original photo, only drops it from the list', () => {
    session.remove(ORIGINAL);

    expect(session.photos).toEqual([`photos/${POINT_ID}/saved-1.jpg`]);
    expect(deletePhotoFiles).not.toHaveBeenCalled();
  });

  it('ignores a path that is not in the list', () => {
    session.remove(`photos/${POINT_ID}/unknown.jpg`);

    expect(session.photos).toHaveLength(2);
    expect(deletePhotoFiles).not.toHaveBeenCalled();
  });

  it('a failed delete is swallowed', () => {
    vi.mocked(deletePhotoFiles).mockRejectedValueOnce(new Error('Disk error'));

    expect(() => session.remove(`photos/${POINT_ID}/saved-1.jpg`)).not.toThrow();
    expect(session.photos).toEqual([ORIGINAL]);
  });

  it('a removed added photo is not deleted a second time on discard', async () => {
    session.remove(`photos/${POINT_ID}/saved-1.jpg`);
    await session.discard();

    expect(deletePhotoFiles).toHaveBeenCalledTimes(1);
  });
});

describe('setCover', () => {
  const second = `photos/${POINT_ID}/second.jpg`;
  const third = `photos/${POINT_ID}/third.jpg`;

  beforeEach(() => {
    session.begin({ pointId: POINT_ID, photos: [ORIGINAL, second, third], isNew: false });
  });

  it('moves the photo to the front and keeps the order of the rest', () => {
    session.setCover(third);

    expect(session.photos).toEqual([third, ORIGINAL, second]);
  });

  it('the cover itself and an unknown path are a no-op', () => {
    session.setCover(ORIGINAL);
    session.setCover(`photos/${POINT_ID}/unknown.jpg`);

    expect(session.photos).toEqual([ORIGINAL, second, third]);
  });

  it('touches no file', () => {
    session.setCover(second);

    expect(deletePhotoFiles).not.toHaveBeenCalled();
    expect(savePhoto).not.toHaveBeenCalled();
  });
});

describe('commit', () => {
  it('prunes the files that are not in the saved list and ends the session', async () => {
    session.begin({ pointId: POINT_ID, photos: [ORIGINAL], isNew: false });
    vi.mocked(takePhoto).mockResolvedValueOnce(sources(1));
    await session.add('camera');
    session.remove(ORIGINAL);

    await session.commit();

    expect(pruneUnreferenced).toHaveBeenCalledWith(POINT_ID, [`photos/${POINT_ID}/saved-1.jpg`]);
    expect(session.pointId).toBeNull();
    expect(session.photos).toEqual([]);
  });

  it('a saved new point keeps its folder', async () => {
    session.begin({ pointId: POINT_ID, photos: [], isNew: true });

    await session.commit();
    await session.discard();

    expect(deletePointPhotos).not.toHaveBeenCalled();
  });

  it('a failed clean up is swallowed', async () => {
    session.begin({ pointId: POINT_ID, photos: [], isNew: false });
    vi.mocked(pruneUnreferenced).mockRejectedValueOnce(new Error('Disk error'));

    await expect(session.commit()).resolves.toBeUndefined();
  });
});

describe('discard', () => {
  it('a new point loses its whole folder', async () => {
    session.begin({ pointId: POINT_ID, photos: [], isNew: true });

    await session.discard();

    expect(deletePointPhotos).toHaveBeenCalledWith(POINT_ID);
    expect(deletePhotoFiles).not.toHaveBeenCalled();
    expect(session.pointId).toBeNull();
  });

  it('an existing point loses only the photos added in this session', async () => {
    session.begin({ pointId: POINT_ID, photos: [ORIGINAL], isNew: false });
    vi.mocked(chooseFromGallery).mockResolvedValueOnce(sources(2));
    await session.add('gallery');
    session.remove(ORIGINAL);

    await session.discard();

    expect(deletePhotoFiles).toHaveBeenCalledWith([`photos/${POINT_ID}/saved-1.jpg`, `photos/${POINT_ID}/saved-2.jpg`]);
    expect(deletePointPhotos).not.toHaveBeenCalled();
  });

  it('an existing point without new photos deletes nothing', async () => {
    session.begin({ pointId: POINT_ID, photos: [ORIGINAL], isNew: false });

    await session.discard();

    expect(deletePhotoFiles).not.toHaveBeenCalled();
    expect(deletePointPhotos).not.toHaveBeenCalled();
  });

  it('a failed delete is swallowed', async () => {
    session.begin({ pointId: POINT_ID, photos: [], isNew: true });
    vi.mocked(deletePointPhotos).mockRejectedValueOnce(new Error('Disk error'));

    await expect(session.discard()).resolves.toBeUndefined();
  });
});

describe('end', () => {
  // The point was deleted: its folder is removed by the caller, nothing is left to clean up here
  it('ends the session without deleting anything', async () => {
    session.begin({ pointId: POINT_ID, photos: [], isNew: true });
    vi.mocked(takePhoto).mockResolvedValueOnce(sources(1));
    await session.add('camera');

    session.end();
    await session.discard();

    expect(session.pointId).toBeNull();
    expect(session.photos).toEqual([]);
    expect(deletePointPhotos).not.toHaveBeenCalled();
    expect(deletePhotoFiles).not.toHaveBeenCalled();
  });
});
