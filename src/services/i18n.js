/**
 * Initial configuration with i18next
 *
 * i18next documentation:               https://www.i18next.com/overview/api
 * Capacitor Preferences documentation: https://capacitorjs.com/docs/apis/preferences#set
 *
 * How to use?
 * Your ComponentName.svelte named import this file:
 *  import { i18nStores } from "@/services/i18n";
 *
 * And create destructuring assignment variable:
 *  const { i18n } = i18nStores;
 *
 * And use with $ (svelte runes):
 * <p> { $i18n.t("ui:app:name") } </p>
 */

// Old configuration with localStorage
// import LanguageDetector from 'i18next-browser-languagedetector';

// // configuration
// i18next.use(LanguageDetector).init({
//   debug: devState ? true : false,
//   detection: {
//     order: ['querystring', 'localStorage', 'navigator'],
//     caches: ['localStorage'],
//     lookupQuerystring: 'lng',
//     lookupLocalStorage: 'locale',
//   },
//   fallbackLng: 'ru',
//   resources: res,
//   interpolation: {
//     escapeValue: false,
//   },
// });

// // initialization store
// export const i18nStores = createI18nStore(i18next);

// New configuration, used Preferences (Capacitor plugin).
import i18next from 'i18next';
import { createI18nStore } from '@/store/i18nextSvelte/i18nextSvelte';

// Locales import
import res from '@/locales/resources';

// Capacitor API`s
import { getStorage, setStorage } from '@/capacitor/utils/appStorage';

// Check this https://vite.dev/guide/env-and-mode.html
let devState = import.meta.env.DEV;

const LANGUAGE_KEY = 'locale';
const FALLBACK_LANG = 'ru';

// Read saved language from Capacitor Preferences (if any)
let initialLng = FALLBACK_LANG;

if (typeof window !== 'undefined') {
  const value = await getStorage(LANGUAGE_KEY, FALLBACK_LANG);
  initialLng = value;
}

// Init i18next (no LanguageDetector)
await i18next.init({
  debug: devState,
  lng: initialLng,
  fallbackLng: FALLBACK_LANG,
  resources: res,
  interpolation: {
    escapeValue: false,
  },
});

// Persist language on every change
i18next.on('languageChanged', async (lng) => {
  try {
    await setStorage(LANGUAGE_KEY, lng);
  } catch (error) {
    console.error('[i18n] Cannot save locale to storage', error);
  }
});

// Svelte store wrapper
export const i18nStores = createI18nStore(i18next);
