import { getPhotoUrl, releasePhotoUrl } from '@/services/customPointsPhotos';
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

/**
 * Keeps track of which photo url each custom point's map popup holds, so it can be given back.
 *
 * On the web, `getPhotoUrl()` hands out a reference-counted Blob url that must be released
 * (`releasePhotoUrl`) once nothing shows it. The map popup takes one per point: when the cover
 * changes, the point is deleted or the map screen goes away, that reference is released here.
 * On a device the url is a plain file url and releasing is a no-op.
 *
 * @returns {{
 *   resolve: (point: { id: string, photos?: Array<string> }) => Promise<string>,
 *   release: (pointId: string) => void,
 *   releaseAll: () => void,
 * }}
 * @example
 * const previews = createPreviewTracker();
 * const url = await previews.resolve(point); // after an edit: takes the new cover, gives back the old one
 * previews.release(point.id);               // the point was deleted
 * previews.releaseAll();                    // the map screen goes away
 */
export function createPreviewTracker() {
  // Point id → photo path whose url that point's popup holds
  const heldPaths = new Map();

  async function resolve(point) {
    const previousPath = heldPaths.get(point.id);
    const coverPath = point.photos?.[0];

    if (coverPath) heldPaths.set(point.id, coverPath);
    else heldPaths.delete(point.id);

    // The new reference is taken before the old one is given back, so an unchanged cover keeps
    // its url instead of being revoked and read again
    const url = await resolvePreview(point);
    if (previousPath) releasePhotoUrl(previousPath);

    return url;
  }

  function release(pointId) {
    const path = heldPaths.get(pointId);
    if (!path) return;

    heldPaths.delete(pointId);
    releasePhotoUrl(path);
  }

  function releaseAll() {
    [...heldPaths.keys()].forEach(release);
  }

  return { resolve, release, releaseAll };
}
