/**
 * Moving the user's points in and out of the app as a file. Knows nothing about the points state:
 * the caller builds the export text (`customPointsState.exportFile()`) and imports the text this
 * module reads (`customPointsState.importFile(text)`).
 *
 * - Export, on a device: the file is written to the cache directory and handed to the system share
 *   sheet (Drive, Files, a messenger). In the web/dev build: a browser download.
 * - Import: the text of a file the user picked with `<input type="file">` (the WebView opens the
 *   system file chooser), refused early when it's far too big to be ours.
 *
 * @example
 * const { text } = await customPointsState.exportFile();
 * const outcome = await deliverExportFile(text, { title, dialogTitle }); // 'shared' | 'cancelled' | 'downloaded'
 *
 * const read = await readImportFile(input.files[0]);
 * if (read.ok) await customPointsState.importFile(read.text);
 */

import { Capacitor } from '@capacitor/core';
import { writeShareableTextFile } from '@/capacitor/utils/appFiles';
import { shareFile } from '@/capacitor/services/share';
import { LIMITS } from '@/services/customPointsFormat';
import { downloadTextFile } from '@/utils/downloadTextFile';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const transferLogger = createLogger('CustomPointsTransfer');

const EXPORT_FILE_PREFIX = 'polskie-slady-points';
export const EXPORT_MIME_TYPE = 'application/json';
const EXPORTS_DIR = 'exports';

// A UTF-8 character takes up to 4 bytes: a file bigger than this can't fit LIMITS.maxFileChars
const MAX_UTF8_BYTES_PER_CHAR = 4;

/**
 * The export's file name, dated by the device's local day: polskie-slady-points-2026-10-18.json
 * @param {Date} date - When the export is made
 * @returns {string} the file name
 */
export function exportFileName(date) {
  const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part) => String(part).padStart(2, '0'))
    .join('-');
  return `${EXPORT_FILE_PREFIX}-${day}.json`;
}

/**
 * Hand an export file to the user: the share sheet on a device, a download in the browser.
 *
 * @param {string} text - The export file content
 * @param {Object} options - Texts and time
 * @param {string} options.title - Share subject, already translated
 * @param {string} options.dialogTitle - Share sheet title, already translated
 * @param {Date} [options.date] - When the export is made (the file name's date)
 * @returns {Promise<'shared'|'cancelled'|'downloaded'>} 'cancelled' — the user closed the sheet
 * @throws {Error} when the file could not be written or the sheet failed
 */
export async function deliverExportFile(text, { title, dialogTitle, date = new Date() }) {
  const fileName = exportFileName(date);

  if (!Capacitor.isNativePlatform()) {
    downloadTextFile(fileName, text, EXPORT_MIME_TYPE);
    return 'downloaded';
  }

  const uri = await writeShareableTextFile(`${EXPORTS_DIR}/${fileName}`, text);
  if (!uri) throw new Error(`Could not write the export file "${fileName}"`);

  return shareFile({ uri, title, dialogTitle });
}

/**
 * Read the file the user picked for an import.
 *
 * @param {File|null|undefined} file - The picked file (`input.files[0]`)
 * @returns {Promise<{ ok: true, text: string } | { ok: false, reason: 'noFile' | 'tooLarge' | 'unreadable' }>}
 *   the text, or why there is none: nothing picked, far over the size limit (not even read), or the
 *   file could not be read
 */
export async function readImportFile(file) {
  if (!file) return { ok: false, reason: 'noFile' };
  if (file.size > LIMITS.maxFileChars * MAX_UTF8_BYTES_PER_CHAR) return { ok: false, reason: 'tooLarge' };

  try {
    return { ok: true, text: await file.text() };
  } catch (error) {
    IS_DEBUG && transferLogger.error('Could not read the import file:', error);
    return { ok: false, reason: 'unreadable' };
  }
}
