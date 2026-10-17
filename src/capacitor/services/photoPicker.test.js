import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { PHOTO_SIZE, PhotoPickerError, chooseFromGallery, takePhoto } from '@/capacitor/services/photoPicker';

// The Camera plugin needs a real camera/gallery: its methods are recorders the tests drive
vi.mock('@capacitor/camera', async (importOriginal) => {
  const actual = await importOriginal();

  return { ...actual, Camera: { takePhoto: vi.fn(), chooseFromGallery: vi.fn() } };
});

const nativeError = (code, message = 'native error') => Object.assign(new Error(message), { code });

beforeEach(() => {
  // vi.fn()s created inside vi.mock are not reset by restoreMocks
  Camera.takePhoto.mockReset();
  Camera.chooseFromGallery.mockReset();
});

describe('takePhoto', () => {
  it('asks for a resized, oriented photo that is not saved to the gallery', async () => {
    Camera.takePhoto.mockResolvedValueOnce({ uri: 'file:///a.jpg', webPath: 'blob:a' });

    await takePhoto();

    expect(Camera.takePhoto).toHaveBeenCalledWith({
      quality: PHOTO_SIZE.quality,
      targetWidth: PHOTO_SIZE.maxSide,
      targetHeight: PHOTO_SIZE.maxSide,
      correctOrientation: true,
      webUseInput: true,
      saveToGallery: false,
    });
  });

  it('returns the photo as a { uri, webPath } source, nothing else', async () => {
    Camera.takePhoto.mockResolvedValueOnce({ uri: 'file:///a.jpg', webPath: 'blob:a', exif: { big: true } });

    expect(await takePhoto()).toEqual([{ uri: 'file:///a.jpg', webPath: 'blob:a' }]);
  });

  it('a result without a uri and a webPath is no photo', async () => {
    Camera.takePhoto.mockResolvedValueOnce({ format: 'jpeg' });

    expect(await takePhoto()).toEqual([]);
  });
});

describe('chooseFromGallery', () => {
  it('asks for photos only, up to the limit', async () => {
    Camera.chooseFromGallery.mockResolvedValueOnce({ results: [] });

    await chooseFromGallery(3);

    expect(Camera.chooseFromGallery).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: MediaTypeSelection.Photo,
        allowMultipleSelection: true,
        limit: 3,
        quality: PHOTO_SIZE.quality,
        targetWidth: PHOTO_SIZE.maxSide,
      }),
    );
  });

  it('a limit of one picks a single photo', async () => {
    Camera.chooseFromGallery.mockResolvedValueOnce({ results: [] });

    await chooseFromGallery(1);

    expect(Camera.chooseFromGallery.mock.lastCall[0].allowMultipleSelection).toBe(false);
  });

  it('keeps only the results that can be read', async () => {
    Camera.chooseFromGallery.mockResolvedValueOnce({
      results: [{ uri: 'file:///a.jpg' }, null, { format: 'jpeg' }, { webPath: 'blob:b' }],
    });

    expect(await chooseFromGallery(4)).toEqual([
      { uri: 'file:///a.jpg', webPath: undefined },
      { uri: undefined, webPath: 'blob:b' },
    ]);
  });
});

describe('errors', () => {
  it.each([
    ['the native take-photo cancel code', nativeError(ERROR_CODES.OS_PLUG_CAMR_0006)],
    ['the native gallery cancel code', nativeError(ERROR_CODES.OS_PLUG_CAMR_0020)],
    ['the web "User cancelled" message', new Error('User cancelled photos app')],
    ['the web "No files selected" message', new Error('No files selected')],
  ])('a cancel (%s) is an empty list, not an error', async (_label, error) => {
    Camera.takePhoto.mockRejectedValueOnce(error);
    Camera.chooseFromGallery.mockRejectedValueOnce(error);

    expect(await takePhoto()).toEqual([]);
    expect(await chooseFromGallery(2)).toEqual([]);
  });

  it.each([ERROR_CODES.OS_PLUG_CAMR_0003, ERROR_CODES.OS_PLUG_CAMR_0005])('%s is a denied permission', async (code) => {
    const error = nativeError(code);
    Camera.takePhoto.mockRejectedValueOnce(error);

    const thrown = await takePhoto().catch((caught) => caught);

    expect(thrown).toBeInstanceOf(PhotoPickerError);
    expect(thrown.kind).toBe('denied');
    expect(thrown.cause).toBe(error);
  });

  it('anything else fails', async () => {
    Camera.chooseFromGallery.mockRejectedValueOnce(new Error('bridge down'));

    await expect(chooseFromGallery(2)).rejects.toMatchObject({ name: 'PhotoPickerError', kind: 'failed' });
  });
});
