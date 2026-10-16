import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPhotoUrl } from '@/services/customPointsPhotos';
import { resolvePreview } from '@/views/Map/MapPreview';

vi.mock('@/services/customPointsPhotos', () => ({ getPhotoUrl: vi.fn() }));

beforeEach(() => getPhotoUrl.mockReset());

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
