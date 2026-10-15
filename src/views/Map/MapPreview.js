import { getPhotoUrl } from '@/services/customPointsPhotos';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const mapPreviewLogger = createLogger('MapPreview');

/**
 * Preview image url of a custom point for the map popup: its first photo (the cover)
 * @param {{ photos: Array<string> }} point - Custom point
 * @returns {Promise<string>} - Url, an empty string if there is no photo or it can not be read
 */
export async function resolvePreview(point) {
  if (!point.photos || point.photos.length === 0) return '';

  try {
    return (await getPhotoUrl(point.photos[0])) || '';
  } catch (error) {
    IS_DEBUG && mapPreviewLogger.error('Failed to get the preview:', error);
    return '';
  }
}
