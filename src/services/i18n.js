/**
 * Initial configuration with i18next
 *
 * i18next documentation: https://www.i18next.com/overview/api
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

import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { createI18nStore } from './i18nextSvelte/i18nextSvelte';

// Locales import
import res from '@/locales/resources';

// Check this https://vite.dev/guide/env-and-mode.html
let devState = import.meta.env.DEV;

// configuration
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

// initialization store
export const i18nStores = createI18nStore(i18next);
