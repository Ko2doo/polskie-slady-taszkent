/**
 * takePhoto, chooseFromGallery helpers
 * API info: https://capacitorjs.com/docs/apis/camera
 *
 * Both return photos as { uri, webPath } sources (see savePhoto in customPointsPhotos).
 * A photo that the user cancelled is not an error: the result is an empty list.
 * Anything else that goes wrong throws PhotoPickerError with kind "denied" or "failed".
 *
 * On a device the plugin resizes and compresses the photo natively, on the web (development) that is done
 * by downscaleImage, with the same numbers (PHOTO_SIZE). The camera needs no permission on Android,
 * the system picker is used for the gallery.
 */

import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const photoPickerLogger = createLogger('PhotoPicker');

// A photo of this size is enough for a full screen view and keeps the files small (weak phones, little storage)
export const PHOTO_SIZE = { maxSide: 1280, quality: 80 };

const PHOTO_OPTIONS = {
  quality: PHOTO_SIZE.quality,
  targetWidth: PHOTO_SIZE.maxSide, // targetWidth and targetHeight work only together
  targetHeight: PHOTO_SIZE.maxSide,
  correctOrientation: true,
  webUseInput: true, // the web version uses a file input, no extra package (@ionic/pwa-elements) is needed
};

// Structured errors of the plugin (Android, iOS)
const CANCEL_CODES = [ERROR_CODES.OS_PLUG_CAMR_0006, ERROR_CODES.OS_PLUG_CAMR_0020];
const DENIED_CODES = [ERROR_CODES.OS_PLUG_CAMR_0003, ERROR_CODES.OS_PLUG_CAMR_0005];

export class PhotoPickerError extends Error {
  /**
   * @param {'denied'|'failed'} kind - What went wrong
   * @param {*} cause - The original error
   */
  constructor(kind, cause) {
    super(`Photo picker ${kind}`);

    this.name = 'PhotoPickerError';
    this.kind = kind;
    this.cause = cause;
  }
}

function classify(error) {
  const code = error && error.code;
  const message = error && typeof error.message === 'string' ? error.message : '';

  // The web implementation says "User cancelled photos app" or "No file(s) selected"
  if (CANCEL_CODES.includes(code) || /cancel|no files? selected/i.test(message)) return 'cancelled';
  if (DENIED_CODES.includes(code)) return 'denied';

  return 'failed';
}

function handleError(error) {
  const kind = classify(error);

  if (kind === 'cancelled') {
    IS_DEBUG && photoPickerLogger.log('Cancelled by the user');
    return [];
  }

  IS_DEBUG && photoPickerLogger.error(`Failed (${kind}):`, error);
  throw new PhotoPickerError(kind, error);
}

function toSources(results) {
  return results
    .filter((result) => result && (result.uri || result.webPath))
    .map(({ uri, webPath }) => ({ uri, webPath }));
}

/**
 * Take a photo with the camera
 * @returns {Promise<Array<{ uri?: string, webPath?: string }>>} - One photo, or an empty list if cancelled
 * @throws {PhotoPickerError}
 */
export async function takePhoto() {
  try {
    const result = await Camera.takePhoto({ ...PHOTO_OPTIONS, saveToGallery: false });

    return toSources([result]);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Choose photos from the gallery
 * @param {number} limit - How many photos may be chosen. It works on Android 13+ and iOS only,
 *   the caller must cut the list anyway.
 * @returns {Promise<Array<{ uri?: string, webPath?: string }>>} - Photos, or an empty list if cancelled
 * @throws {PhotoPickerError}
 */
export async function chooseFromGallery(limit) {
  try {
    const { results } = await Camera.chooseFromGallery({
      ...PHOTO_OPTIONS,
      mediaType: MediaTypeSelection.Photo,
      allowMultipleSelection: limit > 1,
      limit,
    });

    return toSources(results);
  } catch (error) {
    return handleError(error);
  }
}
