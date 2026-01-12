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
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { getStorage, setStorage } from '@/capacitor/utils/appStorage';

// Check this https://vite.dev/guide/env-and-mode.html
let devState = import.meta.env.DEV;

const LANGUAGE_KEY = 'locale';
const FALLBACK_LANG = 'ru';

// System language detection
async function detectInitialLang() {
  const stored = await getStorage(LANGUAGE_KEY, null);
  if (stored && res[stored]) return stored;

  // System language
  try {
    const result = await Device.getLanguageCode();

    if (result?.value) {
      const lang = result.value.split('-')[0];

      if (res[lang]) return lang;
    }
  } catch (error) {
    console.warn('[i18n] Device language detection failed', error);
  }

  return FALLBACK_LANG;
}

// Initialization
const initialLng = await detectInitialLang();

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

// Save locales with Preferences (from first start)
await setStorage(LANGUAGE_KEY, i18next.language);

// Persist language on every change with UI
i18next.on('languageChanged', async (lng) => {
  try {
    await setStorage(LANGUAGE_KEY, lng);
  } catch (error) {
    console.error('[i18n] Cannot save locale to storage', error);
  }
});

// System lang listener
if (Capacitor.isNativePlatform()) {
  App.addListener('resume', async () => {
    const stored = await getStorage(LANGUAGE_KEY, null);

    if (!stored) {
      const lang = await detectInitialLang();
      if (i18next.language !== lang) {
        i18next.changeLanguage(lang);
        await setStorage(LANGUAGE_KEY, lang);
      }
    }
  });
}

// Svelte store wrapper
export const i18nStores = createI18nStore(i18next);
