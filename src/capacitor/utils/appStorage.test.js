import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import { getStorage, removeStorageItem, setStorage } from '@/capacitor/utils/appStorage';

// Every Preferences method is a recorder that calls the real web implementation (localStorage).
// A Capacitor plugin export is a Proxy, so vi.spyOn can not wrap it (see harness/testing.md).
vi.mock('@capacitor/preferences', async (importOriginal) => {
  const actual = await importOriginal();
  const methods = ['get', 'set', 'remove', 'clear'];
  const Preferences = Object.fromEntries(
    methods.map((name) => [name, vi.fn((...args) => actual.Preferences[name](...args))]),
  );

  return { ...actual, Preferences };
});

beforeEach(async () => {
  await Preferences.clear();
});

describe('setStorage / getStorage', () => {
  it.each([
    ['an object', { a: 1, list: [1, 'x'] }],
    ['an array', [1, 2]],
    ['a boolean', true],
    ['a number', 42],
    ['a plain string', 'layoutRows'],
  ])('round-trips %s', async (_label, value) => {
    await setStorage('key', value);

    expect(await getStorage('key')).toEqual(value);
  });

  it('stores every value as JSON', async () => {
    await setStorage('object', { a: 1 });
    await setStorage('flag', true);
    await setStorage('word', 'en');

    expect(Preferences.set).toHaveBeenCalledWith({ key: 'object', value: '{"a":1}' });
    expect(Preferences.set).toHaveBeenCalledWith({ key: 'flag', value: 'true' });
    expect(Preferences.set).toHaveBeenCalledWith({ key: 'word', value: '"en"' });
  });

  it.each(['42', 'true', 'null', '{"a":1}'])('the string %s comes back as a string', async (text) => {
    await setStorage('key', text);

    expect(await getStorage('key')).toBe(text);
  });

  // Values saved by the versions that stored strings as raw text
  it.each([
    ['en', 'en'],
    ['layoutRows', 'layoutRows'],
    ['true', true],
  ])('a value saved by an older version as %s still reads back as before', async (raw, expected) => {
    await Preferences.set({ key: 'old', value: raw });

    expect(await getStorage('old')).toEqual(expected);
  });

  it('a successful write reports true', async () => {
    await expect(setStorage('key', 'x')).resolves.toBe(true);
  });

  it('a missing key returns the fallback (null by default)', async () => {
    expect(await getStorage('missing')).toBeNull();
    expect(await getStorage('missing', 'en')).toBe('en');
  });

  it('a value written by someone else as plain text is returned as is', async () => {
    await Preferences.set({ key: 'raw', value: 'not json {' });

    expect(await getStorage('raw')).toBe('not json {');
  });

  // Preferences are best-effort UI settings: a broken storage must never crash a screen
  it('a failed read returns the fallback', async () => {
    Preferences.get.mockRejectedValueOnce(new Error('storage down'));

    expect(await getStorage('key', 'fallback')).toBe('fallback');
  });

  it('a failed write does not throw, it reports false', async () => {
    Preferences.set.mockRejectedValueOnce(new Error('storage full'));

    await expect(setStorage('key', 'x')).resolves.toBe(false);
  });

  it('an object that can not be serialized does not throw, it reports false', async () => {
    const circular = {};
    circular.self = circular;

    await expect(setStorage('key', circular)).resolves.toBe(false);
    expect(Preferences.set).not.toHaveBeenCalled();
  });
});

describe('removeStorageItem', () => {
  it('removes the key', async () => {
    await setStorage('key', 'x');

    await removeStorageItem('key');

    expect(await getStorage('key')).toBeNull();
  });

  it('a failed remove does not throw', async () => {
    Preferences.remove.mockRejectedValueOnce(new Error('storage down'));

    await expect(removeStorageItem('key')).resolves.toBeUndefined();
  });
});
