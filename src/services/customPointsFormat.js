/**
 * Custom points file format
 *
 * One format for everything: the storage slots (see customPointsStorage) and the import / export files.
 *
 * Envelope:
 *   - format        - always "psl.custom-points", anything else is rejected
 *   - schemaVersion - format version. A newer one than this app knows is refused, an older one is migrated
 *   - appVersion    - version of the app that wrote the file (informational)
 *   - revision      - storage only: increments with every save, the slot with the highest revision wins
 *   - savedAt       - storage only: unix time in ms
 *   - exportId      - export only: unique id of the export
 *   - exportedAt    - export only: unix time in ms
 *   - checksum      - "crc32:<hex>" of the points array. Protects against a damaged file, NOT against a forged one
 *   - points        - array of points
 *
 * Point: { id, title, description, coords: { lng, lat }, preview, photos, createdAt, updatedAt }
 *   - id is a UUID v4, points with the same id are the same point
 *   - createdAt / updatedAt are unix time in ms, updatedAt changes only when the shared data (title, description,
 *     coords) changes
 *   - preview and photos are local only: they are stored on the device, but never exported and never imported
 *   - photos is a list of up to LIMITS.maxPhotos relative paths "photos/<point id>/<uuid>.<ext>", the first one is
 *     the cover. Paths are checked strictly: a path of another point or with ".." is never accepted
 *
 * A file from the outside is untrusted input: everything is validated and rebuilt field by field,
 * unknown fields are dropped.
 */

import { crc32Hex } from '@/utils/crc32';
import { createId, isId } from '@/utils/uuid';

export const FORMAT = 'psl.custom-points';
export const SCHEMA_VERSION = 1;

export const LIMITS = {
  title: 80,
  description: 10000,
  preview: 2048,
  maxPhotos: 4,
  maxPoints: 5000, // import only
  maxFileChars: 10 * 1024 * 1024, // import only
};

// Photos live in the app data directory: photos/<point id>/<uuid>.<ext>
export const PHOTOS_DIR = 'photos';
export const PHOTO_EXTENSIONS = ['jpg', 'png', 'webp'];

// An imported updatedAt further in the future than this is treated as "now" (a wrong clock must not win forever)
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

// Migrations: schemaVersion N -> function(data) that returns data of schemaVersion N + 1
const MIGRATIONS = {};

function getAppVersion() {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toTimestamp(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

/**
 * @param {Array} points - Array of points
 * @returns {string} - "crc32:<hex>"
 */
export function computeChecksum(points) {
  return `crc32:${crc32Hex(JSON.stringify(points))}`;
}

/**
 * @param {string} pointId - Point id (a valid UUID)
 * @param {string} photoId - Photo id (a UUID)
 * @param {string} [extension] - One of PHOTO_EXTENSIONS
 * @returns {string} - Relative path of the photo
 */
export function buildPhotoPath(pointId, photoId, extension = 'jpg') {
  return `${PHOTOS_DIR}/${pointId}/${photoId}.${extension}`;
}

/**
 * Strict check that a value is a photo path of this very point
 * @param {string} pointId - Point id (a valid UUID)
 * @param {*} value - Value to check
 * @returns {boolean}
 */
export function isPhotoPathOf(pointId, value) {
  const prefix = `${PHOTOS_DIR}/${pointId}/`;

  if (typeof value !== 'string' || !value.startsWith(prefix)) return false;

  const name = value.slice(prefix.length);
  const dot = name.lastIndexOf('.');

  // "<uuid>.<ext>": a UUID has 36 characters, so no slashes or ".." can get in
  return dot === 36 && isId(name.slice(0, dot)) && PHOTO_EXTENSIONS.includes(name.slice(dot + 1));
}

/**
 * @param {*} raw - Anything that came from a file
 * @param {string} pointId - Point id (a valid UUID)
 * @returns {Array<string>} - Valid, unique photo paths of this point, at most LIMITS.maxPhotos
 */
export function sanitizePhotos(raw, pointId) {
  if (!Array.isArray(raw)) return [];

  const photos = [];

  for (const value of raw) {
    if (photos.length >= LIMITS.maxPhotos) break;

    if (isPhotoPathOf(pointId, value) && !photos.includes(value)) {
      photos.push(value);
    }
  }

  return photos;
}

/**
 * Validate a raw point and rebuild it with known fields only
 * @param {*} raw - Anything that came from a file
 * @param {Object} [options]
 * @param {boolean} [options.isImport] - Imported points: no local fields, future timestamps are clamped
 * @param {number} [options.now] - Current unix time in ms
 * @returns {Object|null} - Clean point or null if the point is invalid
 */
export function sanitizePoint(raw, { isImport = false, now = Date.now() } = {}) {
  if (!isPlainObject(raw) || !isId(raw.id)) return null;

  // The text limits are for the input and for imported files. Our own storage is never rejected because of them:
  // otherwise lowering a limit in a later version would silently delete the points that no longer fit.
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  if (!title || (isImport && title.length > LIMITS.title)) return null;

  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  if (isImport && description.length > LIMITS.description) return null;

  if (!isPlainObject(raw.coords)) return null;

  const { lng, lat } = raw.coords;
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;

  let createdAt = toTimestamp(raw.createdAt);
  let updatedAt = toTimestamp(raw.updatedAt);
  if (createdAt === null || updatedAt === null) return null;

  if (isImport && updatedAt > now + MAX_FUTURE_MS) {
    updatedAt = now;
  }

  if (createdAt > updatedAt) {
    createdAt = updatedAt;
  }

  const hasPreview = !isImport && typeof raw.preview === 'string' && raw.preview.length <= LIMITS.preview;

  return {
    id: raw.id,
    title,
    description,
    coords: { lng, lat },
    preview: hasPreview ? raw.preview : '',
    photos: isImport ? [] : sanitizePhotos(raw.photos, raw.id),
    createdAt,
    updatedAt,
  };
}

function migrate(data) {
  let current = data;

  while (current.schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schemaVersion];

    if (!step) return null;

    current = step(current);
  }

  return current;
}

function fail(reason) {
  return { ok: false, reason, revision: null };
}

/**
 * Parse and validate a file
 * @param {string} text - File content
 * @param {Object} [options]
 * @param {'storage'|'import'} [options.kind] - Storage files are ours: no size limits, revision is required.
 *   Import files are untrusted: size limits, clamped timestamps, no local fields
 * @param {number} [options.now] - Current unix time in ms
 * @returns {{ ok: true, points: Array, skipped: number, revision: number|null }
 *   | { ok: false, reason: string, revision: number|null }}
 *   reason: tooLarge | invalidJson | unknownFormat | invalidFile | unsupportedVersion | tooManyPoints
 *   | checksumMismatch
 */
export function parseFile(text, { kind = 'import', now = Date.now() } = {}) {
  const isImport = kind === 'import';

  if (typeof text !== 'string') return fail('invalidFile');
  if (isImport && text.length > LIMITS.maxFileChars) return fail('tooLarge');

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    return fail('invalidJson');
  }

  if (!isPlainObject(data) || data.format !== FORMAT) return fail('unknownFormat');

  if (!Number.isInteger(data.schemaVersion) || data.schemaVersion < 1) return fail('invalidFile');

  const revision = Number.isInteger(data.revision) && data.revision >= 1 ? data.revision : null;

  // Written by a newer app: the caller decides what to do (the storage must not touch such a file)
  if (data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, reason: 'unsupportedVersion', revision };
  }

  if (!Array.isArray(data.points)) return fail('invalidFile');
  if (isImport && data.points.length > LIMITS.maxPoints) return fail('tooManyPoints');
  if (!isImport && revision === null) return fail('invalidFile');

  // The checksum belongs to the file as it was written, so it is checked before the migration
  if (data.checksum !== computeChecksum(data.points)) return fail('checksumMismatch');

  const migrated = migrate(data);
  if (!migrated) return fail('invalidFile');

  // The same id twice in a file: the newest wins
  const byId = new Map();
  let skipped = 0;

  for (const raw of migrated.points) {
    const point = sanitizePoint(raw, { isImport, now });

    if (!point) {
      skipped += 1;
      continue;
    }

    const existing = byId.get(point.id);

    if (!existing || point.updatedAt > existing.updatedAt) {
      byId.set(point.id, point);
    }
  }

  return { ok: true, points: [...byId.values()], skipped, revision };
}

/**
 * Serialize points for a storage slot
 * @param {Array} points - Points to save (all fields, including local ones)
 * @param {Object} options
 * @param {number} options.revision - Revision of this save
 * @param {number} options.now - Current unix time in ms
 * @returns {string} - File content
 */
export function buildStorageFile(points, { revision, now }) {
  return JSON.stringify({
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion: getAppVersion(),
    revision,
    savedAt: now,
    checksum: computeChecksum(points),
    points,
  });
}

/**
 * The shared part of a point, the part that leaves the device: preview and photos are local
 * files that mean nothing on another phone
 * @param {Object} point - A point with all fields
 * @returns {{ id: string, title: string, description: string, coords: { lng: number, lat: number },
 *   createdAt: number, updatedAt: number }} the point as an export file carries it
 */
function toSharedPoint(point) {
  const { id, title, description, coords, createdAt, updatedAt } = point;
  return { id, title, description, coords: { lng: coords.lng, lat: coords.lat }, createdAt, updatedAt };
}

/**
 * Serialize points for an export file — what the user shares to move their points to another
 * device or keep a copy. Only the shared fields go out (no preview, no photos, no storage
 * revision); `parseFile(text, { kind: 'import' })` reads it back.
 *
 * @param {Array<Object>} points - The points to export (all fields; the local ones are dropped)
 * @param {Object} [options] - Envelope values, injectable for tests
 * @param {number} [options.now] - Current unix time in ms (`exportedAt`)
 * @param {string} [options.exportId] - Unique id of this export (a UUID)
 * @returns {string} - File content
 *
 * @example
 * const text = buildExportFile(customPointsState.points);
 * // ...share it; on another device:
 * const result = parseFile(text, { kind: 'import' }); // { ok: true, points, skipped }
 */
export function buildExportFile(points, { now = Date.now(), exportId = createId() } = {}) {
  const sharedPoints = points.map(toSharedPoint);

  return JSON.stringify({
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    appVersion: getAppVersion(),
    exportId,
    exportedAt: now,
    checksum: computeChecksum(sharedPoints),
    points: sharedPoints,
  });
}
