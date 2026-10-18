import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LIMITS } from '@/services/customPointsFormat';
import { EXPORT_MIME_TYPE, deliverExportFile, exportFileName, readImportFile } from '@/services/customPointsTransfer';

const deps = vi.hoisted(() => ({}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => deps.isNative } }));
vi.mock('@/capacitor/utils/appFiles', () => ({
  writeShareableTextFile: (...args) => deps.writeShareableTextFile(...args),
}));
vi.mock('@/capacitor/services/share', () => ({ shareFile: (...args) => deps.shareFile(...args) }));
vi.mock('@/utils/downloadTextFile', () => ({ downloadTextFile: (...args) => deps.downloadTextFile(...args) }));

const DATE = new Date(2026, 0, 5, 23, 59); // local time: 5 January
const TEXTS = { title: 'Points', dialogTitle: 'Share points', date: DATE };

beforeEach(() => {
  deps.isNative = true;
  deps.writeShareableTextFile = vi.fn(async (path) => `file:///cache/${path}`);
  deps.shareFile = vi.fn(async () => 'shared');
  deps.downloadTextFile = vi.fn();
});

describe('exportFileName', () => {
  it('is dated by the local day, zero-padded', () => {
    expect(exportFileName(DATE)).toBe('polskie-slady-points-2026-01-05.json');
  });

  it('uses the device day, not the UTC one', () => {
    // Tashkent is UTC+5: half past midnight on 5 January is still 4 January in UTC
    vi.stubEnv('TZ', 'Asia/Tashkent');
    const justAfterMidnight = new Date(2026, 0, 5, 0, 30);

    expect(justAfterMidnight.getUTCDate()).toBe(4);
    expect(exportFileName(justAfterMidnight)).toBe('polskie-slady-points-2026-01-05.json');
  });
});

describe('deliverExportFile', () => {
  it('on a device: writes the file to the cache and opens the share sheet for it', async () => {
    expect(await deliverExportFile('{"points":[]}', TEXTS)).toBe('shared');

    expect(deps.writeShareableTextFile).toHaveBeenCalledWith(
      'exports/polskie-slady-points-2026-01-05.json',
      '{"points":[]}',
    );
    expect(deps.shareFile).toHaveBeenCalledWith({
      uri: 'file:///cache/exports/polskie-slady-points-2026-01-05.json',
      title: 'Points',
      dialogTitle: 'Share points',
    });
    expect(deps.downloadTextFile).not.toHaveBeenCalled();
  });

  it('passes on a closed share sheet', async () => {
    deps.shareFile.mockResolvedValueOnce('cancelled');

    expect(await deliverExportFile('x', TEXTS)).toBe('cancelled');
  });

  it('a file that could not be written is an error, the sheet is not opened', async () => {
    deps.writeShareableTextFile.mockResolvedValueOnce(null);

    await expect(deliverExportFile('x', TEXTS)).rejects.toThrow('Could not write the export file');
    expect(deps.shareFile).not.toHaveBeenCalled();
  });

  it('in the browser: a download, no file, no share sheet', async () => {
    deps.isNative = false;

    expect(await deliverExportFile('x', TEXTS)).toBe('downloaded');
    expect(deps.downloadTextFile).toHaveBeenCalledWith('polskie-slady-points-2026-01-05.json', 'x', EXPORT_MIME_TYPE);
    expect(deps.writeShareableTextFile).not.toHaveBeenCalled();
    expect(deps.shareFile).not.toHaveBeenCalled();
  });
});

describe('readImportFile', () => {
  const fileOf = (text) => new File([text], 'points.json', { type: 'application/json' });

  it('reads the text of the picked file', async () => {
    expect(await readImportFile(fileOf('{"a":1}'))).toEqual({ ok: true, text: '{"a":1}' });
  });

  it.each([null, undefined])('nothing picked (%s)', async (file) => {
    expect(await readImportFile(file)).toEqual({ ok: false, reason: 'noFile' });
  });

  it('a file far over the limit is refused without reading it', async () => {
    const huge = { size: LIMITS.maxFileChars * 4 + 1, text: vi.fn() };

    expect(await readImportFile(huge)).toEqual({ ok: false, reason: 'tooLarge' });
    expect(huge.text).not.toHaveBeenCalled();
  });

  it('a file right at the byte bound is still read (the exact limit is parseFile’s)', async () => {
    const atBound = { size: LIMITS.maxFileChars * 4, text: vi.fn(async () => 'x') };

    expect(await readImportFile(atBound)).toEqual({ ok: true, text: 'x' });
  });

  it('a file that can not be read', async () => {
    const broken = { size: 10, text: vi.fn(async () => Promise.reject(new Error('NotReadableError'))) };

    expect(await readImportFile(broken)).toEqual({ ok: false, reason: 'unreadable' });
  });
});
