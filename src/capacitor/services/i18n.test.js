import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Preferences } from '@capacitor/preferences';

// Every Preferences method is a recorder that calls the real web implementation (localStorage).
vi.mock('@capacitor/preferences', async (importOriginal) => {
  const actual = await importOriginal();
  const methods = ['get', 'set', 'remove', 'clear'];
  const Preferences = Object.fromEntries(
    methods.map((name) => [name, vi.fn((...args) => actual.Preferences[name](...args))]),
  );

  return { ...actual, Preferences };
});

// The device language is whatever the test says
const device = vi.hoisted(() => ({ getLanguageCode: null }));

vi.mock('@capacitor/device', () => ({
  Device: { getLanguageCode: (...args) => device.getLanguageCode(...args) },
}));

// The module initializes i18next with a top-level await when imported: every test imports a fresh copy
async function load() {
  vi.resetModules();
  const { i18nStores } = await import('@/capacitor/services/i18n');
  const { get } = await import('svelte/store');
  return get(i18nStores.i18n);
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  await Preferences.clear();
  device.getLanguageCode = vi.fn(async () => ({ value: 'en-US' }));
});

describe('initial language', () => {
  it('the saved choice wins over the device language', async () => {
    await Preferences.set({ key: 'locale', value: 'pl' });
    device.getLanguageCode = vi.fn(async () => ({ value: 'ru-RU' }));

    expect((await load()).language).toBe('pl');
  });

  it('first launch: the device language, without its region', async () => {
    device.getLanguageCode = vi.fn(async () => ({ value: 'uz-Latn-UZ' }));

    expect((await load()).language).toBe('uz');
  });

  it('a saved language the app does not have is ignored', async () => {
    await Preferences.set({ key: 'locale', value: 'de' });
    device.getLanguageCode = vi.fn(async () => ({ value: 'ru' }));

    expect((await load()).language).toBe('ru');
  });

  it('a device language the app does not have falls back to English', async () => {
    device.getLanguageCode = vi.fn(async () => ({ value: 'de-DE' }));

    expect((await load()).language).toBe('en');
  });

  it('a failing device query falls back to English', async () => {
    device.getLanguageCode = vi.fn(async () => {
      throw new Error('not implemented');
    });

    expect((await load()).language).toBe('en');
  });
});

describe('language change', () => {
  it('saves the new language for the next launch', async () => {
    const i18n = await load();

    await i18n.changeLanguage('pl');
    await settle();

    const { getStorage } = await import('@/capacitor/utils/appStorage');
    expect(await getStorage('locale')).toBe('pl');
  });

  it('translates through the bundled resources, with English as the fallback', async () => {
    const i18n = await load();

    await i18n.changeLanguage('ru');

    expect(i18n.options.fallbackLng).toEqual(['en']);
    expect(i18n.hasResourceBundle('ru', 'ui')).toBe(true);
  });
});
