/**
 * i18next Configuration - Manual Language Selection
 *
 * Features:
 * - Detects system language on first launch (as initial value)
 * - Stores user language preference in Capacitor Preferences
 * - User can manually change language in settings
 * - Language persists across app restarts
 *
 * Usage:
 * import { i18nStores } from '@/services/i18n';
 * const { i18n } = i18nStores;
 *
 * // In template:
 * <p>{$i18n.t('ui:app:name')}</p>
 *
 * // Change language:
 * $i18n.changeLanguage('en');
 *
 * Documentation:
 * - i18next: https://www.i18next.com/overview/api
 * - Capacitor Preferences: https://capacitorjs.com/docs/apis/preferences
 */

import i18next from 'i18next';
import { createI18nStore } from '@/store/i18nextSvelte/i18nextSvelte';

// Locales
import res from '@/locales/resources';

// Capacitor APIs
import { Device } from '@capacitor/device';
import { getStorage, setStorage } from '@/capacitor/utils/appStorage';

// Configuration
const IS_DEV = import.meta.env.DEV;
const LANGUAGE_KEY = 'locale';
const FALLBACK_LANG = 'en';

/**
 * Detect initial language on first app launch
 * Priority: stored preference > system language > fallback
 *
 * @returns {Promise<string>} - Language code (e.g., 'en', 'ru', 'uz')
 */
async function detectInitialLanguage() {
  // 1. Check if user has saved preference
  const stored = await getStorage(LANGUAGE_KEY, null);

  if (stored && res[stored]) {
    console.log('[i18n] Using stored language:', stored);
    return stored;
  }

  // 2. Try system language (only on first launch)
  try {
    const result = await Device.getLanguageCode();

    if (result?.value) {
      // Extract language code from locale (e.g., 'en-US' -> 'en')
      const lang = result.value.split('-')[0];

      // Check if language exists in resources
      if (res[lang]) {
        console.log('[i18n] Using system language:', lang);
        return lang;
      }

      console.log(`[i18n] System language "${lang}" not available in resources`);
    }
  } catch (error) {
    console.warn('[i18n] Failed to detect system language:', error);
  }

  // 3. Use fallback
  console.log('[i18n] Using fallback language:', FALLBACK_LANG);
  return FALLBACK_LANG;
}

/**
 * Initialize i18next
 */
async function initializeI18n() {
  console.log('[i18n] Initializing...');

  // Detect initial language
  const initialLng = await detectInitialLanguage();

  // Initialize i18next
  await i18next.init({
    debug: IS_DEV,
    lng: initialLng,
    fallbackLng: FALLBACK_LANG,
    resources: res,
    interpolation: {
      escapeValue: false,
    },
  });

  console.log('[i18n] Initialized with language:', initialLng);
}

// Initialize
await initializeI18n();

/**
 * Handle language changes from UI
 * Automatically saves to storage when user changes language
 */
i18next.on('languageChanged', async (lng) => {
  try {
    await setStorage(LANGUAGE_KEY, lng);
    console.log('[i18n] Language changed and saved:', lng);
  } catch (error) {
    console.error('[i18n] Failed to save language:', error);
  }
});

// Svelte store wrapper
export const i18nStores = createI18nStore(i18next);
