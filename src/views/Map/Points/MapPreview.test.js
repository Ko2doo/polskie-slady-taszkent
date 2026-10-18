import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPhotoUrl, releasePhotoUrl } from '@/services/customPointsPhotos';
import { createPreviewTracker, resolvePreview } from './MapPreview';

vi.mock('@/services/customPointsPhotos', () => ({ getPhotoUrl: vi.fn(), releasePhotoUrl: vi.fn() }));

beforeEach(() => {
  getPhotoUrl.mockReset();
  releasePhotoUrl.mockReset();
});

describe('resolvePreview', () => {
  it('is the url of the cover (the first photo)', async () => {
    getPhotoUrl.mockResolvedValueOnce('blob:cover');

    expect(await resolvePreview({ photos: ['photos/a/1.jpg', 'photos/a/2.jpg'] })).toBe('blob:cover');
    expect(getPhotoUrl).toHaveBeenCalledWith('photos/a/1.jpg');
  });

  it('no photos: no preview, nothing is read', async () => {
    expect(await resolvePreview({ photos: [] })).toBe('');
    expect(await resolvePreview({})).toBe('');
    expect(getPhotoUrl).not.toHaveBeenCalled();
  });

  it('a missing or unreadable photo: no preview, no error', async () => {
    getPhotoUrl.mockResolvedValueOnce(null);
    expect(await resolvePreview({ photos: ['photos/a/1.jpg'] })).toBe('');

    getPhotoUrl.mockRejectedValueOnce(new Error('Permission denied'));
    expect(await resolvePreview({ photos: ['photos/a/1.jpg'] })).toBe('');
  });
});

describe('createPreviewTracker', () => {
  // Like the real web cache: every getPhotoUrl takes a reference, every releasePhotoUrl gives one back
  let refs;
  beforeEach(() => {
    refs = new Map();
    getPhotoUrl.mockImplementation(async (path) => {
      refs.set(path, (refs.get(path) ?? 0) + 1);
      return `blob:${path}`;
    });
    releasePhotoUrl.mockImplementation((path) => refs.set(path, refs.get(path) - 1));
  });

  const point = (id, ...photos) => ({ id, photos });

  it('holds one reference per point while its popup shows the cover', async () => {
    const previews = createPreviewTracker();

    expect(await previews.resolve(point('p1', 'photos/p1/a.jpg'))).toBe('blob:photos/p1/a.jpg');
    expect(refs.get('photos/p1/a.jpg')).toBe(1);
  });

  it('a new cover takes its reference and gives the old one back', async () => {
    const previews = createPreviewTracker();
    await previews.resolve(point('p1', 'photos/p1/a.jpg'));

    await previews.resolve(point('p1', 'photos/p1/b.jpg', 'photos/p1/a.jpg'));

    expect(refs.get('photos/p1/a.jpg')).toBe(0);
    expect(refs.get('photos/p1/b.jpg')).toBe(1);
  });

  // An edit that keeps the cover must not revoke the url it is showing
  it('an unchanged cover is never let go of in between', async () => {
    const previews = createPreviewTracker();
    await previews.resolve(point('p1', 'photos/p1/a.jpg'));
    const seen = [];
    releasePhotoUrl.mockImplementation((path) => {
      seen.push(refs.get(path));
      refs.set(path, refs.get(path) - 1);
    });

    await previews.resolve(point('p1', 'photos/p1/a.jpg'));

    expect(seen).toEqual([2]);
    expect(refs.get('photos/p1/a.jpg')).toBe(1);
  });

  it('removing all photos gives the cover back', async () => {
    const previews = createPreviewTracker();
    await previews.resolve(point('p1', 'photos/p1/a.jpg'));

    expect(await previews.resolve(point('p1'))).toBe('');

    expect(refs.get('photos/p1/a.jpg')).toBe(0);
  });

  it('release gives back one point, releaseAll all of them; both only once', async () => {
    const previews = createPreviewTracker();
    await previews.resolve(point('p1', 'photos/p1/a.jpg'));
    await previews.resolve(point('p2', 'photos/p2/a.jpg'));

    previews.release('p1');
    previews.release('p1');
    expect(refs.get('photos/p1/a.jpg')).toBe(0);
    expect(refs.get('photos/p2/a.jpg')).toBe(1);

    previews.releaseAll();
    previews.releaseAll();
    expect(refs.get('photos/p2/a.jpg')).toBe(0);
    expect(releasePhotoUrl).toHaveBeenCalledTimes(2);
  });

  it('a point without photos holds nothing to release', async () => {
    const previews = createPreviewTracker();
    await previews.resolve(point('p1'));

    previews.release('p1');

    expect(releasePhotoUrl).not.toHaveBeenCalled();
  });
});
