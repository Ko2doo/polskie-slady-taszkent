/**
 * Initial i18n
 */

import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { createI18nStore } from './i18nextSvelte/i18nextSvelte';

// Locales import
import res from '../locales/resources';

// Check this https://vite.dev/guide/env-and-mode.html
let devState = import.meta.env.DEV;

// config
i18next.use(LanguageDetector).init({
  debug: devState ? true : false,
  detection: {
    order: ['querystring', 'localStorage', 'navigator'],
    caches: ['localStorage'],
    lookupQuerystring: 'lng',
    lookupLocalStorage: 'locale',
  },
  fallbackLng: 'ru',
  resources: res,
  interpolation: {
    escapeValue: false,
  },
});

// initialization
export const i18nStores = createI18nStore(i18next);
