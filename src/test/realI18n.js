/**
 * Test-only: an i18n store backed by a real, isolated i18next instance with the app's real locale
 * files — for components that render structures straight from the translations
 * (`returnObjects: true`), so a test also checks the locale data itself.
 *
 * `fallbackLng: false` on purpose: a key missing in one language must show up as missing, not
 * silently fall back to English.
 *
 * Usage: const i18n = await realI18n('pl'); mount(About, { target, props: { i18n, route } });
 */
import i18next from 'i18next';
import resources from '@/locales/resources';

export const LANGUAGES = Object.keys(resources);

export async function realI18n(language) {
  const instance = i18next.createInstance();
  await instance.init({ lng: language, fallbackLng: false, resources });
  return {
    subscribe(listener) {
      listener(instance);
      return () => {};
    },
  };
}
