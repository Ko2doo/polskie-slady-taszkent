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

  it('stores objects as JSON and the rest as text', async () => {
    await setStorage('object', { a: 1 });
    await setStorage('flag', true);

    expect(Preferences.set).toHaveBeenCalledWith({ key: 'object', value: '{"a":1}' });
    expect(Preferences.set).toHaveBeenCalledWith({ key: 'flag', value: 'true' });
  });

  // BUG: a string that looks like JSON comes back as another type ('42' -> 42, 'true' -> true)
  // (see BUGS.md). Remove `.fails` once fixed.
  it.fails('a string that looks like JSON comes back as a string', async () => {
    await setStorage('key', '42');

    expect(await getStorage('key')).toBe('42');
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

  it('a failed write does not throw', async () => {
    Preferences.set.mockRejectedValueOnce(new Error('storage full'));

    await expect(setStorage('key', 'x')).resolves.toBeUndefined();
  });

  it('an object that can not be serialized does not throw', async () => {
    const circular = {};
    circular.self = circular;

    await expect(setStorage('key', circular)).resolves.toBeUndefined();
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
