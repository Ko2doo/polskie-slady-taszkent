import { I18NextTranslationStore } from './translationStore';

/**
 * Wraps an initialized i18next instance into Svelte stores.
 * @param {import('i18next').i18n} i18n - an i18next instance (capacitor/services/i18n.js)
 * @returns {{ i18n: import('svelte/store').Writable, isLoading: import('svelte/store').Writable<boolean>,
 *   isError: import('svelte/store').Writable<boolean> }} `$i18n.t(...)` re-renders on a language change
 */
export const createI18nStore = (i18n) => {
  const i18nStore = new I18NextTranslationStore(i18n);

  return {
    i18n: i18nStore.i18n,
    isLoading: i18nStore.isLoading,
    isError: i18nStore.isError,
  };
};
