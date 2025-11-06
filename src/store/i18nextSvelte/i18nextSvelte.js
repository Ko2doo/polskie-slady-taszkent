import { I18NextTranslationStore } from './translationStore';

export const createI18nStore = (i18n) => {
  const i18nStore = new I18NextTranslationStore(i18n);

  return {
    i18n: i18nStore.i18n,
    isLoading: i18nStore.isLoading,
    isError: i18nStore.isError,
  };
};
