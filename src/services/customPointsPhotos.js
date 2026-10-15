/**
 * CustomPointsPhotos
 *
 * Purpose:
 *   Keeps the photos of custom points on the device. A photo is a file in the app data directory:
 *   photos/<point id>/<uuid>.<ext>. The point only stores the relative paths (see customPointsFormat),
 *   so nothing depends on where the system keeps the app data (it can change after an update or a restore).
 *
 * Performance rules (the app also runs on weak phones):
 *   - A photo is copied by the native side. Its bytes never go through the JS bridge (no base64, no big strings).
 *     Base64 is only the fallback if the copy fails.
 *   - Nothing here decodes or resizes an image
 *   - The startup check (reconcilePhotos) is ONE directory listing, no file is opened or measured
 *   - The base uri of the data directory is asked once, a display url is plain string work afterwards
 *   - On the web (development) a display url is a Blob url, kept in a cache until it is released
 *
 * Safety rules:
 *   - A path is accepted only if it has exactly the shape photos/<uuid>/<uuid>.<ext>
 *   - The startup check never deletes anything when it could not list the folder
 *   - A folder of a point that got photos in this session is never treated as an orphan
 *
 * Usage:
 *   const path = await savePhoto({ pointId, source: { uri, webPath } });   // then keep `path` in point.photos
 *   const url = await getPhotoUrl(path);                                   // for <img src>
 *   await deletePointPhotos(pointId);                                      // when the point is removed
 */

import { Capacitor } from '@capacitor/core';
import {
  copyFileToData,
  ensureDirectory,
  getDataDirectoryUri,
  listDirectory,
  readBinaryFile,
  removeDirectory,
  removeFile,
  writeBinaryFile,
} from '@/capacitor/utils/appFiles';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';
import { createId, isId } from '@/utils/uuid';
import { PHOTOS_DIR, PHOTO_EXTENSIONS, buildPhotoPath, isPhotoPathOf } from './customPointsFormat';

const customPointsPhotosLogger = createLogger('CustomPointsPhotos');

// Points that got photos in this session (their folder may belong to a point that is not saved yet)
const protectedIds = new Set();

// Folders already created in this session: one bridge call less for every next photo of a point
const createdFolders = new Set();

// Web only: display urls (path -> Promise<url|null>)
const webUrls = new Map();

function folderOf(pointId) {
  return `${PHOTOS_DIR}/${pointId}`;
}

/**
 * @param {string} path - Photo path
 * @returns {string|null} - Id of the point the path belongs to, null if it is not a photo path
 */
function pointIdOfPath(path) {
  if (typeof path !== 'string') return null;

  const pointId = path.split('/')[1];

  return isId(pointId) && isPhotoPathOf(pointId, path) ? pointId : null;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function readSourceBlob(source) {
  if (!source || !source.webPath) {
    throw new Error('The photo can not be read: there is no webPath');
  }

  const response = await fetch(source.webPath);

  return response.blob();
}

async function saveOnDevice(pointId, path, source) {
  if (!createdFolders.has(pointId)) {
    if (!(await ensureDirectory(folderOf(pointId)))) {
      throw new Error(`Failed to create "${folderOf(pointId)}"`);
    }

    createdFolders.add(pointId);
  }

  if (source && source.uri && (await copyFileToData(source.uri, path))) return;

  // The fallback: slow and memory hungry (the whole photo goes through the bridge as base64)
  IS_DEBUG && customPointsPhotosLogger.warn('Native copy failed, falling back to base64');

  const base64 = await blobToBase64(await readSourceBlob(source));

  if ((await writeBinaryFile(path, base64)) === null) {
    throw new Error(`Failed to write "${path}"`);
  }
}

async function saveOnWeb(path, source) {
  const blob = await readSourceBlob(source);

  if ((await writeBinaryFile(path, blob)) === null) {
    throw new Error(`Failed to write "${path}"`);
  }
}

/**
 * Save a photo of a point into the app data directory
 * @param {Object} options
 * @param {string} options.pointId - Id of the point (it may be an id of a point that is not saved yet)
 * @param {{ uri?: string, webPath?: string }} options.source - A photo as the Camera plugin returns it:
 *   `uri` is used on a device, `webPath` on the web (and as the fallback on a device)
 * @param {string} [options.extension] - One of PHOTO_EXTENSIONS
 * @returns {Promise<string>} - Relative path of the saved photo
 * @throws if the photo could not be saved
 */
export async function savePhoto({ pointId, source, extension = 'jpg' }) {
  if (!isId(pointId)) throw new Error('Invalid point id');
  if (!PHOTO_EXTENSIONS.includes(extension)) throw new Error(`Unsupported photo extension "${extension}"`);

  const path = buildPhotoPath(pointId, createId(), extension);

  protectedIds.add(pointId);

  if (Capacitor.isNativePlatform()) {
    await saveOnDevice(pointId, path, source);
  } else {
    await saveOnWeb(path, source);
  }

  IS_DEBUG && customPointsPhotosLogger.log(`Photo saved: ${path}`);

  return path;
}

/**
 * Release a display url (web only, it frees the memory of the Blob)
 * @param {string} path - Photo path
 */
export async function releasePhotoUrl(path) {
  const pending = webUrls.get(path);

  if (!pending) return;

  webUrls.delete(path);

  try {
    const url = await pending;

    if (url) URL.revokeObjectURL(url);
  } catch {
    // The file could not be read, so there is no url to release
  }
}

/**
 * Delete photo files. Anything that is not a photo path is ignored.
 * @param {Array<string>} paths - Photo paths
 * @returns {Promise<void>}
 */
export async function deletePhotoFiles(paths) {
  for (const path of paths) {
    if (!pointIdOfPath(path)) continue;

    releasePhotoUrl(path);
    await removeFile(path);
  }
}

/**
 * Delete all photos of a point (the whole folder)
 * @param {string} pointId - Point id
 * @returns {Promise<void>}
 */
export async function deletePointPhotos(pointId) {
  if (!isId(pointId)) return;

  createdFolders.delete(pointId);
  protectedIds.delete(pointId);

  for (const path of [...webUrls.keys()]) {
    if (isPhotoPathOf(pointId, path)) releasePhotoUrl(path);
  }

  await removeDirectory(folderOf(pointId));
}

/**
 * Delete the files of a point that are not in the keep list (a photo that was taken, but not saved with the point).
 * One directory listing.
 * @param {string} pointId - Point id
 * @param {Array<string>} keepPaths - Photo paths that must stay
 * @returns {Promise<number>} - How many files were deleted
 */
export async function pruneUnreferenced(pointId, keepPaths) {
  if (!isId(pointId)) return 0;

  let entries;

  try {
    entries = await listDirectory(folderOf(pointId));
  } catch {
    return 0;
  }

  const keep = new Set(keepPaths);
  const extra = entries.filter((entry) => entry.type === 'file' && !keep.has(`${folderOf(pointId)}/${entry.name}`));

  for (const entry of extra) {
    await removeFile(`${folderOf(pointId)}/${entry.name}`);
  }

  return extra.length;
}

/**
 * The startup check: delete the folders of points that do not exist (a point removed while the app was killed,
 * a photo taken for a point that was never saved) and find the points whose photos are gone (a restored backup).
 *
 * ONE directory listing. Call it only if the points were loaded completely: with an empty or a partial list
 * every folder would look like an orphan.
 *
 * @param {Array<{ id: string, photos: Array<string> }>} points - All points
 * @returns {Promise<{ removedOrphans: number, pointsWithoutFolder: Array<string> }>} - Ids of the points that have
 *   photo paths but no folder: their paths can be dropped
 * @throws if the folder could not be listed (nothing is deleted then)
 */
export async function reconcilePhotos(points) {
  const entries = await listDirectory(PHOTOS_DIR);

  const pointIds = new Set(points.map((point) => point.id));
  const orphans = entries.filter((entry) => !pointIds.has(entry.name) && !protectedIds.has(entry.name));

  for (const orphan of orphans) {
    const path = `${PHOTOS_DIR}/${orphan.name}`;

    if (orphan.type === 'directory') await removeDirectory(path);
    else await removeFile(path);
  }

  const existing = new Set(entries.map((entry) => entry.name));
  const pointsWithoutFolder = points
    .filter((point) => point.photos.length > 0 && !existing.has(point.id))
    .map((point) => point.id);

  IS_DEBUG &&
    customPointsPhotosLogger.log(`Reconciled: ${orphans.length} orphans, ${pointsWithoutFolder.length} without photos`);

  return { removedOrphans: orphans.length, pointsWithoutFolder };
}

/**
 * Display url of a photo, for <img src>
 *   - on a device: the file uri converted for the WebView (plain string work after the first call)
 *   - on the web (development): a Blob url, the same one for the same photo until it is released
 * @param {string} path - Photo path
 * @returns {Promise<string|null>} - Url, null if the path is not a photo path or the file does not exist
 * @throws if the file exists, but could not be read (web only)
 */
export async function getPhotoUrl(path) {
  if (!pointIdOfPath(path)) return null;

  if (Capacitor.isNativePlatform()) {
    return Capacitor.convertFileSrc(`${await getDataDirectoryUri()}/${path}`);
  }

  if (!webUrls.has(path)) {
    const pending = readBinaryFile(path).then((data) => (data instanceof Blob ? URL.createObjectURL(data) : null));

    // Do not remember a failure or a missing file
    pending.then((url) => url || webUrls.delete(path)).catch(() => webUrls.delete(path));
    webUrls.set(path, pending);
  }

  return webUrls.get(path);
}
