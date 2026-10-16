import { describe, it, expect } from 'vitest';
import {
  FORMAT,
  SCHEMA_VERSION,
  LIMITS,
  PHOTOS_DIR,
  computeChecksum,
  buildPhotoPath,
  isPhotoPathOf,
  sanitizePhotos,
  sanitizePoint,
  parseFile,
  buildStorageFile,
} from '@/services/customPointsFormat';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const PHOTO_ID = '9b2f6a3e-1c4d-4e5f-8a6b-7c8d9e0f1a2b';
const PHOTO_ID_2 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const NOW = 1_760_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function makePoint(overrides = {}) {
  return {
    id: ID,
    title: 'Kościół',
    description: 'Opis',
    coords: { lng: 69.24, lat: 41.31 },
    preview: '',
    photos: [],
    createdAt: NOW - 1000,
    updatedAt: NOW - 500,
    ...overrides,
  };
}

// A file whose checksum matches its points (unless overridden)
function makeFileText(points, overrides = {}) {
  return JSON.stringify({
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    revision: 1,
    checksum: computeChecksum(points),
    points,
    ...overrides,
  });
}

describe('computeChecksum', () => {
  it('is "crc32:" + 8 hex digits and changes with the points', () => {
    const a = computeChecksum([makePoint()]);

    expect(a).toMatch(/^crc32:[0-9a-f]{8}$/);
    expect(computeChecksum([makePoint({ title: 'Other' })])).not.toBe(a);
  });
});

describe('photo paths', () => {
  it('builds photos/<point id>/<photo id>.<ext>, jpg by default', () => {
    expect(buildPhotoPath(ID, PHOTO_ID)).toBe(`${PHOTOS_DIR}/${ID}/${PHOTO_ID}.jpg`);
    expect(buildPhotoPath(ID, PHOTO_ID, 'webp')).toBe(`${PHOTOS_DIR}/${ID}/${PHOTO_ID}.webp`);
  });

  it('accepts a built path of the same point for every allowed extension', () => {
    ['jpg', 'png', 'webp'].forEach((ext) => {
      expect(isPhotoPathOf(ID, buildPhotoPath(ID, PHOTO_ID, ext))).toBe(true);
    });
  });

  // Paths come from files: a hostile one must never point outside its own point's folder
  it.each([
    ['another point', buildPhotoPath(OTHER_ID, PHOTO_ID)],
    ['parent traversal', `${PHOTOS_DIR}/${ID}/../${OTHER_ID}/${PHOTO_ID}.jpg`],
    ['nested traversal', `${PHOTOS_DIR}/${ID}/../../secret.jpg`],
    ['absolute path', `/${PHOTOS_DIR}/${ID}/${PHOTO_ID}.jpg`],
    ['subfolder', `${PHOTOS_DIR}/${ID}/sub/${PHOTO_ID}.jpg`],
    ['not a uuid name', `${PHOTOS_DIR}/${ID}/photo.jpg`],
    ['disallowed extension', `${PHOTOS_DIR}/${ID}/${PHOTO_ID}.svg`],
    ['double extension', `${PHOTOS_DIR}/${ID}/${PHOTO_ID}.jpg.html`],
    ['no extension', `${PHOTOS_DIR}/${ID}/${PHOTO_ID}`],
    ['other root dir', `files/${ID}/${PHOTO_ID}.jpg`],
    ['not a string', 42],
  ])('rejects %s', (_, value) => {
    expect(isPhotoPathOf(ID, value)).toBe(false);
  });
});

describe('sanitizePhotos', () => {
  it('returns [] for anything but an array', () => {
    [undefined, null, 'photos', { 0: 'a' }].forEach((raw) => expect(sanitizePhotos(raw, ID)).toEqual([]));
  });

  it('keeps valid paths in order, drops invalid ones and duplicates', () => {
    const a = buildPhotoPath(ID, PHOTO_ID);
    const b = buildPhotoPath(ID, PHOTO_ID_2, 'png');

    expect(sanitizePhotos([a, buildPhotoPath(OTHER_ID, PHOTO_ID), a, 'x', b], ID)).toEqual([a, b]);
  });

  it('keeps at most LIMITS.maxPhotos', () => {
    const ids = [PHOTO_ID, PHOTO_ID_2, OTHER_ID, ID, '11111111-2222-4333-8444-555555555555'];
    const paths = ids.map((photoId) => buildPhotoPath(ID, photoId));

    const result = sanitizePhotos(paths, ID);

    expect(result).toHaveLength(LIMITS.maxPhotos);
    expect(result).toEqual(paths.slice(0, LIMITS.maxPhotos));
  });
});

describe('sanitizePoint', () => {
  it('rebuilds a valid point with known fields only', () => {
    const raw = { ...makePoint(), extra: 'x', __proto__: { polluted: true } };

    const point = sanitizePoint(raw);

    expect(point).toEqual(makePoint());
    expect(point).not.toHaveProperty('extra');
    expect(Object.getPrototypeOf(point)).toBe(Object.prototype);
  });

  it('trims title and description', () => {
    expect(sanitizePoint(makePoint({ title: '  A  ', description: ' d ' }))).toMatchObject({
      title: 'A',
      description: 'd',
    });
  });

  it('defaults a missing description to an empty string', () => {
    expect(sanitizePoint(makePoint({ description: undefined })).description).toBe('');
  });

  it.each([
    ['not an object', 'point'],
    ['an array', []],
    ['an invalid id', makePoint({ id: 'not-a-uuid' })],
    ['an empty title', makePoint({ title: '   ' })],
    ['a non-string title', makePoint({ title: 42 })],
    ['no coords', makePoint({ coords: undefined })],
    ['coords as an array', makePoint({ coords: [69, 41] })],
    ['a non-numeric lng', makePoint({ coords: { lng: '69', lat: 41 } })],
    ['NaN lat', makePoint({ coords: { lng: 69, lat: NaN } })],
    ['lng out of range', makePoint({ coords: { lng: 180.01, lat: 41 } })],
    ['lat out of range', makePoint({ coords: { lng: 69, lat: -90.01 } })],
    ['a missing createdAt', makePoint({ createdAt: undefined })],
    ['a negative updatedAt', makePoint({ updatedAt: -1 })],
    ['an infinite updatedAt', makePoint({ updatedAt: Infinity })],
  ])('rejects %s', (_, raw) => {
    expect(sanitizePoint(raw)).toBeNull();
  });

  it('accepts coords exactly on the range edges', () => {
    expect(sanitizePoint(makePoint({ coords: { lng: -180, lat: 90 } }))).not.toBeNull();
  });

  it('floors fractional timestamps', () => {
    expect(sanitizePoint(makePoint({ createdAt: 10.9, updatedAt: 20.2 }))).toMatchObject({
      createdAt: 10,
      updatedAt: 20,
    });
  });

  it('pulls createdAt back to updatedAt when it is later', () => {
    expect(sanitizePoint(makePoint({ createdAt: 500, updatedAt: 100 }))).toMatchObject({
      createdAt: 100,
      updatedAt: 100,
    });
  });

  describe('own storage (not an import)', () => {
    // Lowering a limit in a later version must never delete points already on disk
    it('does not apply the text limits', () => {
      const title = 'T'.repeat(LIMITS.title + 1);
      const description = 'D'.repeat(LIMITS.description + 1);

      expect(sanitizePoint(makePoint({ title, description }))).toMatchObject({ title, description });
    });

    it('keeps local fields: a preview within the limit and valid photos', () => {
      const photo = buildPhotoPath(ID, PHOTO_ID);
      const preview = 'p'.repeat(LIMITS.preview);

      expect(sanitizePoint(makePoint({ preview, photos: [photo, '../x'] }))).toMatchObject({
        preview,
        photos: [photo],
      });
    });

    it('drops a preview over the limit or of a wrong type', () => {
      expect(sanitizePoint(makePoint({ preview: 'p'.repeat(LIMITS.preview + 1) })).preview).toBe('');
      expect(sanitizePoint(makePoint({ preview: 42 })).preview).toBe('');
    });

    it('keeps a far-future updatedAt as is', () => {
      const updatedAt = NOW + 10 * DAY_MS;

      expect(sanitizePoint(makePoint({ updatedAt }), { now: NOW }).updatedAt).toBe(updatedAt);
    });
  });

  describe('import', () => {
    const asImport = { isImport: true, now: NOW };

    it('accepts text exactly at the limits and rejects one character more', () => {
      expect(sanitizePoint(makePoint({ title: 'T'.repeat(LIMITS.title) }), asImport)).not.toBeNull();
      expect(sanitizePoint(makePoint({ title: 'T'.repeat(LIMITS.title + 1) }), asImport)).toBeNull();
      expect(sanitizePoint(makePoint({ description: 'D'.repeat(LIMITS.description) }), asImport)).not.toBeNull();
      expect(sanitizePoint(makePoint({ description: 'D'.repeat(LIMITS.description + 1) }), asImport)).toBeNull();
    });

    it('measures the title limit after trimming', () => {
      expect(sanitizePoint(makePoint({ title: `  ${'T'.repeat(LIMITS.title)}  ` }), asImport)).not.toBeNull();
    });

    it('never imports local fields (preview, photos)', () => {
      const point = sanitizePoint(makePoint({ preview: 'p', photos: [buildPhotoPath(ID, PHOTO_ID)] }), asImport);

      expect(point.preview).toBe('');
      expect(point.photos).toEqual([]);
    });

    it('clamps an updatedAt more than a day in the future to now', () => {
      const point = sanitizePoint(makePoint({ createdAt: NOW, updatedAt: NOW + DAY_MS + 1 }), asImport);

      expect(point.updatedAt).toBe(NOW);
      expect(point.createdAt).toBe(NOW);
    });

    it('keeps an updatedAt exactly one day in the future', () => {
      expect(sanitizePoint(makePoint({ updatedAt: NOW + DAY_MS }), asImport).updatedAt).toBe(NOW + DAY_MS);
    });
  });
});

describe('parseFile', () => {
  it('parses a valid storage file', () => {
    const result = parseFile(makeFileText([makePoint()], { revision: 7 }), { kind: 'storage', now: NOW });

    expect(result).toEqual({ ok: true, points: [makePoint()], skipped: 0, revision: 7 });
  });

  it('parses a valid import file without a revision', () => {
    const result = parseFile(makeFileText([makePoint()], { revision: undefined }), { now: NOW });

    expect(result.ok).toBe(true);
    expect(result.revision).toBeNull();
  });

  it.each([
    ['not a string', 42, 'invalidFile'],
    ['broken JSON', '{"format":', 'invalidJson'],
    ['a JSON array', '[]', 'unknownFormat'],
    ['a foreign format', JSON.stringify({ format: 'other', schemaVersion: 1, points: [] }), 'unknownFormat'],
    ['no schemaVersion', makeFileText([], { schemaVersion: undefined }), 'invalidFile'],
    ['schemaVersion 0', makeFileText([], { schemaVersion: 0 }), 'invalidFile'],
    ['a fractional schemaVersion', makeFileText([], { schemaVersion: 1.5 }), 'invalidFile'],
    ['points not an array', makeFileText([], { points: {}, checksum: computeChecksum({}) }), 'invalidFile'],
    ['a wrong checksum', makeFileText([makePoint()], { checksum: 'crc32:00000000' }), 'checksumMismatch'],
    ['no checksum', makeFileText([makePoint()], { checksum: undefined }), 'checksumMismatch'],
  ])('rejects %s', (_, text, reason) => {
    expect(parseFile(text, { now: NOW })).toMatchObject({ ok: false, reason });
  });

  it('detects a point edited by hand after saving (corruption check)', () => {
    const text = makeFileText([makePoint()]).replace('Kościół', 'Kosciol');

    expect(parseFile(text, { now: NOW })).toMatchObject({ ok: false, reason: 'checksumMismatch' });
  });

  it('refuses a file from a newer app and still reports its revision', () => {
    const text = makeFileText([], { schemaVersion: SCHEMA_VERSION + 1, revision: 9 });

    expect(parseFile(text, { kind: 'storage' })).toEqual({ ok: false, reason: 'unsupportedVersion', revision: 9 });
  });

  describe('storage files', () => {
    it.each([
      ['a missing revision', undefined],
      ['revision 0', 0],
      ['a fractional revision', 1.5],
    ])('reject %s', (_, revision) => {
      expect(parseFile(makeFileText([], { revision }), { kind: 'storage' })).toMatchObject({
        ok: false,
        reason: 'invalidFile',
      });
    });

    it('have no size or point-count limits', () => {
      const points = Array.from({ length: LIMITS.maxPoints + 1 }, () => makePoint());

      expect(parseFile(makeFileText(points), { kind: 'storage', now: NOW }).ok).toBe(true);
    });
  });

  describe('import files', () => {
    it('reject a file over the size limit before parsing it', () => {
      const text = ' '.repeat(LIMITS.maxFileChars + 1);

      expect(parseFile(text)).toMatchObject({ ok: false, reason: 'tooLarge' });
    });

    it('reject more than LIMITS.maxPoints points and accept exactly the limit', () => {
      const atLimit = Array.from({ length: LIMITS.maxPoints }, () => makePoint());

      expect(parseFile(makeFileText(atLimit), { now: NOW }).ok).toBe(true);
      expect(parseFile(makeFileText([...atLimit, makePoint()]), { now: NOW })).toMatchObject({
        ok: false,
        reason: 'tooManyPoints',
      });
    });
  });

  it('skips invalid points and counts them', () => {
    const points = [makePoint(), makePoint({ id: 'bad' }), makePoint({ id: OTHER_ID, title: '' })];

    const result = parseFile(makeFileText(points), { now: NOW });

    expect(result.points).toEqual([makePoint()]);
    expect(result.skipped).toBe(2);
  });

  it('keeps the newest of points with the same id', () => {
    const older = makePoint({ title: 'Old', updatedAt: NOW - 100 });
    const newer = makePoint({ title: 'New', updatedAt: NOW - 50 });

    expect(parseFile(makeFileText([newer, older]), { now: NOW }).points).toEqual([newer]);
    expect(parseFile(makeFileText([older, newer]), { now: NOW }).points).toEqual([newer]);
  });

  it('keeps the first of same-id points with an equal updatedAt', () => {
    const first = makePoint({ title: 'First' });
    const second = makePoint({ title: 'Second' });

    expect(parseFile(makeFileText([first, second]), { now: NOW }).points[0].title).toBe('First');
  });

  it('applies the import rules only to imports', () => {
    const point = makePoint({ preview: 'p', photos: [buildPhotoPath(ID, PHOTO_ID)] });

    expect(parseFile(makeFileText([point]), { kind: 'storage', now: NOW }).points[0].photos).toHaveLength(1);
    expect(parseFile(makeFileText([point]), { kind: 'import', now: NOW }).points[0].photos).toEqual([]);
  });
});

describe('buildStorageFile', () => {
  it('writes the full envelope', () => {
    const data = JSON.parse(buildStorageFile([makePoint()], { revision: 3, now: NOW }));

    expect(data).toEqual({
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      appVersion: __APP_VERSION__,
      revision: 3,
      savedAt: NOW,
      checksum: computeChecksum([makePoint()]),
      points: [makePoint()],
    });
  });

  it('round-trips through parseFile as a storage file', () => {
    const points = [makePoint(), makePoint({ id: OTHER_ID, photos: [buildPhotoPath(OTHER_ID, PHOTO_ID)] })];

    const result = parseFile(buildStorageFile(points, { revision: 5, now: NOW }), { kind: 'storage', now: NOW });

    expect(result).toEqual({ ok: true, points, skipped: 0, revision: 5 });
  });
});
