import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import {
  readTextFile,
  writeTextFile,
  dataFilesDriver,
  listDirectory,
  ensureDirectory,
  removeFile,
  removeDirectory,
  copyFileToData,
  writeBinaryFile,
  readBinaryFile,
} from '@/capacitor/utils/appFiles';

// Every Filesystem method is a recorder that calls the real web implementation (IndexedDB from
// fake-indexeddb) by default. A test overrides one call (`mockRejectedValueOnce`) to simulate a
// native-only failure, e.g. an error code the web implementation never produces.
vi.mock('@capacitor/filesystem', async (importOriginal) => {
  const actual = await importOriginal();
  const methods = ['readFile', 'writeFile', 'readdir', 'mkdir', 'deleteFile', 'rmdir', 'copy', 'getUri'];
  const Filesystem = Object.fromEntries(
    methods.map((name) => [name, vi.fn((...args) => actual.Filesystem[name](...args))]),
  );

  return { ...actual, Filesystem };
});

const nativeError = (code, message = 'native error') => Object.assign(new Error(message), { code });

// fake-indexeddb is shared by the whole file: every test works in its own folder
let dir;
let testIndex = 0;

beforeEach(() => {
  testIndex += 1;
  dir = `t${testIndex}`;
});

describe('readTextFile / writeTextFile', () => {
  it('round-trips UTF-8 text and creates missing parent folders', async () => {
    const uri = await writeTextFile(`${dir}/a/b/note.json`, '{"title":"Kościół ż"}');

    expect(uri).toBeTruthy();
    expect(await readTextFile(`${dir}/a/b/note.json`)).toBe('{"title":"Kościół ż"}');
  });

  it('writes to Directory.Data by default with recursive folders', async () => {
    await writeTextFile(`${dir}/x.txt`, 'x');

    expect(Filesystem.writeFile).toHaveBeenLastCalledWith({
      path: `${dir}/x.txt`,
      data: 'x',
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  });

  it('returns null for a missing file (web error message)', async () => {
    expect(await readTextFile(`${dir}/missing.txt`)).toBeNull();
  });

  it('returns null for the native "file does not exist" code', async () => {
    Filesystem.readFile.mockRejectedValueOnce(nativeError(ERROR_CODES.OS_PLUG_FILE_0008));

    expect(await readTextFile(`${dir}/x.txt`)).toBeNull();
  });

  // A read error must never look like "no file": the caller would overwrite user data
  it('throws on any other read error', async () => {
    const error = nativeError('OS-PLUG-FILE-0005', 'Permission denied');
    Filesystem.readFile.mockRejectedValueOnce(error);

    await expect(readTextFile(`${dir}/x.txt`)).rejects.toBe(error);
  });

  it('throws when the plugin returns non-text data', async () => {
    Filesystem.readFile.mockResolvedValueOnce({ data: new Blob(['x']) });

    await expect(readTextFile(`${dir}/x.txt`)).rejects.toThrow(/Unexpected data type/);
  });

  it('writeTextFile returns null instead of throwing on a failed write', async () => {
    Filesystem.writeFile.mockRejectedValueOnce(new Error('Disk full'));

    expect(await writeTextFile(`${dir}/x.txt`, 'x')).toBeNull();
  });

  it('writeTextFile falls back to the path when the plugin returns no uri', async () => {
    Filesystem.writeFile.mockResolvedValueOnce({});

    expect(await writeTextFile(`${dir}/x.txt`, 'x')).toBe(`${dir}/x.txt`);
  });
});

describe('dataFilesDriver', () => {
  it('reads and writes through the text helpers', async () => {
    await dataFilesDriver.write(`${dir}/slot.json`, 'data');

    expect(await dataFilesDriver.read(`${dir}/slot.json`)).toBe('data');
    expect(await dataFilesDriver.read(`${dir}/missing.json`)).toBeNull();
  });

  it('write throws when writing failed (the storage relies on it)', async () => {
    Filesystem.writeFile.mockRejectedValueOnce(new Error('Disk full'));

    await expect(dataFilesDriver.write(`${dir}/slot.json`, 'data')).rejects.toThrow(/Failed to write/);
  });
});

describe('listDirectory', () => {
  it('lists names and types only', async () => {
    await writeTextFile(`${dir}/list/a.txt`, 'a');
    await ensureDirectory(`${dir}/list/sub`);

    const entries = await listDirectory(`${dir}/list`);

    expect(entries).toEqual(
      expect.arrayContaining([
        { name: 'a.txt', type: 'file' },
        { name: 'sub', type: 'directory' },
      ]),
    );
    expect(entries).toHaveLength(2);
  });

  it('returns [] for a missing directory', async () => {
    expect(await listDirectory(`${dir}/nope`)).toEqual([]);
  });

  it('throws on any other error (an unreadable folder must not look empty)', async () => {
    Filesystem.readdir.mockRejectedValueOnce(nativeError('OS-PLUG-FILE-0005', 'Permission denied'));

    await expect(listDirectory(`${dir}/x`)).rejects.toThrow('Permission denied');
  });
});

describe('ensureDirectory', () => {
  it('creates a directory with its parents', async () => {
    expect(await ensureDirectory(`${dir}/a/b/c`)).toBe(true);
    expect(await listDirectory(`${dir}/a/b`)).toEqual([{ name: 'c', type: 'directory' }]);
  });

  it('treats an existing directory as success (web message)', async () => {
    await ensureDirectory(`${dir}/d`);

    expect(await ensureDirectory(`${dir}/d`)).toBe(true);
  });

  it('treats the native "already exists" code as success', async () => {
    Filesystem.mkdir.mockRejectedValueOnce(nativeError(ERROR_CODES.OS_PLUG_FILE_0010));

    expect(await ensureDirectory(`${dir}/d`)).toBe(true);
  });

  it('returns false on a real failure', async () => {
    Filesystem.mkdir.mockRejectedValueOnce(new Error('Permission denied'));

    expect(await ensureDirectory(`${dir}/d`)).toBe(false);
  });
});

describe('removeFile / removeDirectory', () => {
  it('removes a file', async () => {
    await writeTextFile(`${dir}/f.txt`, 'x');

    expect(await removeFile(`${dir}/f.txt`)).toBe(true);
    expect(await readTextFile(`${dir}/f.txt`)).toBeNull();
  });

  it('removes a directory with its content', async () => {
    await writeTextFile(`${dir}/tree/a/b.txt`, 'x');

    expect(await removeDirectory(`${dir}/tree`)).toBe(true);
    expect(await listDirectory(`${dir}/tree`)).toEqual([]);
  });

  it('treat an already missing file / directory as removed', async () => {
    expect(await removeFile(`${dir}/missing.txt`)).toBe(true);
    expect(await removeDirectory(`${dir}/missing`)).toBe(true);
  });

  it('return false on a real failure', async () => {
    Filesystem.deleteFile.mockRejectedValueOnce(new Error('Permission denied'));
    Filesystem.rmdir.mockRejectedValueOnce(new Error('Permission denied'));

    expect(await removeFile(`${dir}/x.txt`)).toBe(false);
    expect(await removeDirectory(`${dir}/x`)).toBe(false);
  });
});

describe('copyFileToData', () => {
  // Native-to-native copy: the uri is passed as is and only the target directory is set
  it('asks the plugin for a native copy into Directory.Data', async () => {
    Filesystem.copy.mockResolvedValueOnce({ uri: 'file:///data/photos/x.jpg' });

    expect(await copyFileToData('file:///cache/picked.jpg', 'photos/x.jpg')).toBe(true);
    expect(Filesystem.copy).toHaveBeenLastCalledWith({
      from: 'file:///cache/picked.jpg',
      to: 'photos/x.jpg',
      toDirectory: Directory.Data,
    });
  });

  it('returns false when the copy fails', async () => {
    Filesystem.copy.mockRejectedValueOnce(new Error('No such file'));

    expect(await copyFileToData('file:///cache/picked.jpg', 'photos/x.jpg')).toBe(false);
  });
});

describe('writeBinaryFile / readBinaryFile', () => {
  it('round-trips base64 data', async () => {
    const data = btoa('binary');

    expect(await writeBinaryFile(`${dir}/b/x.bin`, data)).toBeTruthy();
    expect(await readBinaryFile(`${dir}/b/x.bin`)).toBe(data);
  });

  it('writes without an encoding and with recursive folders', async () => {
    await writeBinaryFile(`${dir}/x.bin`, 'AAAA');

    expect(Filesystem.writeFile).toHaveBeenLastCalledWith({
      path: `${dir}/x.bin`,
      data: 'AAAA',
      directory: Directory.Data,
      recursive: true,
    });
  });

  it('returns null for a missing file and throws on other read errors', async () => {
    expect(await readBinaryFile(`${dir}/missing.bin`)).toBeNull();

    Filesystem.readFile.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(readBinaryFile(`${dir}/x.bin`)).rejects.toThrow('Permission denied');
  });

  it('writeBinaryFile returns null on a failed write', async () => {
    Filesystem.writeFile.mockRejectedValueOnce(new Error('Disk full'));

    expect(await writeBinaryFile(`${dir}/x.bin`, 'AAAA')).toBeNull();
  });
});

describe('getDataDirectoryUri', () => {
  // The uri is cached at module level: every test imports a fresh copy of the module
  async function loadFresh() {
    vi.resetModules();
    const files = await import('@/capacitor/utils/appFiles');
    const { Filesystem: plugin } = await import('@capacitor/filesystem');
    return { getDataDirectoryUri: files.getDataDirectoryUri, plugin };
  }

  it('strips trailing slashes', async () => {
    const { getDataDirectoryUri, plugin } = await loadFresh();
    plugin.getUri.mockResolvedValueOnce({ uri: 'file:///data/user/0/app/files//' });

    expect(await getDataDirectoryUri()).toBe('file:///data/user/0/app/files');
  });

  it('asks the plugin only once (one bridge call total)', async () => {
    const { getDataDirectoryUri, plugin } = await loadFresh();
    plugin.getUri.mockClear();

    await Promise.all([getDataDirectoryUri(), getDataDirectoryUri()]);
    await getDataDirectoryUri();

    expect(plugin.getUri).toHaveBeenCalledTimes(1);
  });

  it('does not remember a failure', async () => {
    const { getDataDirectoryUri, plugin } = await loadFresh();
    plugin.getUri.mockClear();
    plugin.getUri.mockRejectedValueOnce(new Error('bridge down'));

    await expect(getDataDirectoryUri()).rejects.toThrow('bridge down');
    expect(await getDataDirectoryUri()).toBe('/DATA');
    expect(plugin.getUri).toHaveBeenCalledTimes(2);
  });
});
