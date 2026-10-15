/**
 * readTextFile, writeTextFile helpers
 * API info: https://capacitorjs.com/docs/apis/filesystem
 *
 * Files live in Directory.Data by default: private app storage, no permissions are needed.
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const capFilesLogger = createLogger('Files');

// "Operation failed because file does not exist" (Android, iOS). The web implementation throws a plain Error.
const FILE_NOT_FOUND_CODE = 'OS-PLUG-FILE-0008';

function isNotFoundError(error) {
  if (error && error.code === FILE_NOT_FOUND_CODE) return true;

  const message = error && typeof error.message === 'string' ? error.message : '';

  return /does not exist|no such file|not found/i.test(message);
}

/**
 * Read a UTF-8 text file
 *
 * Unlike appStorage helpers this one THROWS on real errors: a file that could not be read
 * must never be mistaken for a file that does not exist (the caller could overwrite user data).
 *
 * @param {string} path - Path inside the directory
 * @param {string} [directory] - Capacitor Directory, Data by default
 * @returns {Promise<string|null>} - File content, null if the file does not exist
 */
export async function readTextFile(path, directory = Directory.Data) {
  try {
    const { data } = await Filesystem.readFile({ path, directory, encoding: Encoding.UTF8 });

    if (typeof data !== 'string') {
      throw new Error(`Unexpected data type of "${path}"`);
    }

    return data;
  } catch (error) {
    if (isNotFoundError(error)) return null;

    IS_DEBUG && capFilesLogger.error(`Filesystem.readFile("${path}") failed:`, error);
    throw error;
  }
}

/**
 * Write a UTF-8 text file (missing parent folders are created)
 * @param {string} path - Path inside the directory
 * @param {string} text - File content
 * @param {string} [directory] - Capacitor Directory, Data by default
 * @returns {Promise<string|null>} - File uri, null if writing failed
 */
export async function writeTextFile(path, text, directory = Directory.Data) {
  try {
    const { uri } = await Filesystem.writeFile({
      path,
      data: text,
      directory,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    return uri || path;
  } catch (error) {
    IS_DEBUG && capFilesLogger.error(`Filesystem.writeFile("${path}") failed:`, error);
    return null;
  }
}

/**
 * Driver for services that store data in files (see customPointsStorage)
 */
export const dataFilesDriver = {
  read: (path) => readTextFile(path),

  async write(path, text) {
    const uri = await writeTextFile(path, text);

    if (uri === null) {
      throw new Error(`Failed to write "${path}"`);
    }
  },
};
