/**
 * readTextFile, writeTextFile helpers
 * API info: https://capacitorjs.com/docs/apis/filesystem
 *
 * Files live in Directory.Data by default: private app storage, no permissions are needed.
 */

import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const capFilesLogger = createLogger('Files');

function isNotFoundError(error) {
  // "Operation failed because file does not exist" (Android, iOS). The web implementation throws a plain Error.
  if (error && error.code === ERROR_CODES.OS_PLUG_FILE_0008) return true;

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

/**
 * List a directory (not recursive)
 *
 * Throws on real errors, like readTextFile: an unreadable folder must not look like an empty one.
 *
 * @param {string} path - Directory path
 * @param {string} [directory] - Capacitor Directory, Data by default
 * @returns {Promise<Array<{ name: string, type: 'file'|'directory' }>>} - Entries, empty if the directory is missing
 */
export async function listDirectory(path, directory = Directory.Data) {
  try {
    const { files } = await Filesystem.readdir({ path, directory });

    return files.map(({ name, type }) => ({ name, type }));
  } catch (error) {
    if (isNotFoundError(error)) return [];

    IS_DEBUG && capFilesLogger.error(`Filesystem.readdir("${path}") failed:`, error);
    throw error;
  }
}

/**
 * Create a directory with its parents. An existing one is fine.
 * @param {string} path - Directory path
 * @param {string} [directory] - Capacitor Directory, Data by default
 * @returns {Promise<boolean>} - true if the directory exists afterwards
 */
export async function ensureDirectory(path, directory = Directory.Data) {
  try {
    await Filesystem.mkdir({ path, directory, recursive: true });
    return true;
  } catch (error) {
    // "Directory already exists" is exactly what we want. The wording differs: Android and iOS say
    // "already exists, cannot be overwritten" (code OS_PLUG_FILE_0010), the web one says "does already exist"
    if (error && error.code === ERROR_CODES.OS_PLUG_FILE_0010) return true;
    if (/already exist/i.test(error && typeof error.message === 'string' ? error.message : '')) return true;

    IS_DEBUG && capFilesLogger.error(`Filesystem.mkdir("${path}") failed:`, error);
    return false;
  }
}

/**
 * Delete a file. A file that is already gone counts as deleted.
 * @param {string} path - File path
 * @param {string} [directory] - Capacitor Directory, Data by default
 * @returns {Promise<boolean>} - false only if the deleting really failed
 */
export async function removeFile(path, directory = Directory.Data) {
  try {
    await Filesystem.deleteFile({ path, directory });
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return true;

    IS_DEBUG && capFilesLogger.error(`Filesystem.deleteFile("${path}") failed:`, error);
    return false;
  }
}

/**
 * Delete a directory with everything in it. A directory that is already gone counts as deleted.
 * @param {string} path - Directory path
 * @param {string} [directory] - Capacitor Directory, Data by default
 * @returns {Promise<boolean>} - false only if the deleting really failed
 */
export async function removeDirectory(path, directory = Directory.Data) {
  try {
    await Filesystem.rmdir({ path, directory, recursive: true });
    return true;
  } catch (error) {
    if (isNotFoundError(error)) return true;

    IS_DEBUG && capFilesLogger.error(`Filesystem.rmdir("${path}") failed:`, error);
    return false;
  }
}

/**
 * Copy a file by its uri into the Data directory. The copy is made by the native side, the content
 * never goes through the JS bridge (no base64, no memory spikes). The target folder must exist.
 * @param {string} from - Uri of the source file
 * @param {string} to - Target path inside the Data directory
 * @returns {Promise<boolean>}
 */
export async function copyFileToData(from, to) {
  try {
    await Filesystem.copy({ from, to, toDirectory: Directory.Data });
    return true;
  } catch (error) {
    IS_DEBUG && capFilesLogger.error(`Filesystem.copy("${from}" -> "${to}") failed:`, error);
    return false;
  }
}

/**
 * Write a binary file (missing parent folders are created)
 * @param {string} path - Path inside the directory
 * @param {Blob|string} data - A Blob (web only) or base64 text (native)
 * @param {string} [directory] - Capacitor Directory, Data by default
 * @returns {Promise<string|null>} - File uri, null if writing failed
 */
export async function writeBinaryFile(path, data, directory = Directory.Data) {
  try {
    const { uri } = await Filesystem.writeFile({ path, data, directory, recursive: true });

    return uri || path;
  } catch (error) {
    IS_DEBUG && capFilesLogger.error(`Filesystem.writeFile("${path}") failed:`, error);
    return null;
  }
}

/**
 * Read a binary file. Needed only on the web, where files have no url (on a device they are shown by their uri).
 * Throws on real errors, like readTextFile.
 * @param {string} path - Path inside the directory
 * @param {string} [directory] - Capacitor Directory, Data by default
 * @returns {Promise<Blob|string|null>} - A Blob (web) or base64 text, null if the file does not exist
 */
export async function readBinaryFile(path, directory = Directory.Data) {
  try {
    const { data } = await Filesystem.readFile({ path, directory });

    return data;
  } catch (error) {
    if (isNotFoundError(error)) return null;

    IS_DEBUG && capFilesLogger.error(`Filesystem.readFile("${path}") failed:`, error);
    throw error;
  }
}

let dataDirectoryUri = null;

/**
 * Uri of the Data directory without a trailing slash. Asked once: after that a file uri is plain string work.
 * @returns {Promise<string>}
 */
export function getDataDirectoryUri() {
  if (!dataDirectoryUri) {
    dataDirectoryUri = Filesystem.getUri({ path: '', directory: Directory.Data })
      .then(({ uri }) => uri.replace(/\/+$/, ''))
      .catch((error) => {
        // Do not remember a failure
        dataDirectoryUri = null;
        throw error;
      });
  }

  return dataDirectoryUri;
}
