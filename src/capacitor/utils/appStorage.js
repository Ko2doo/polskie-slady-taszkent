/**
 * setStorage, getStorage helpers
 * API info: https://capacitorjs.com/docs/apis/preferences
 */

import { Preferences } from '@capacitor/preferences';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const capStorageLogger = createLogger('Storage');

/**
 * Save a value under `key`. Every value is stored as JSON, so it reads back with its own type:
 * the string '42' stays '42', not 42 (`undefined` is stored as `null`). Values saved by older
 * versions as raw text ('en') still read back as that text — see getStorage.
 *
 * Never throws: Preferences hold UI settings, a broken storage must not crash a screen. A caller
 * that must know whether the value was really saved (a "done once" flag) checks the result.
 *
 * @param {string} key
 * @param {unknown} value - anything JSON can represent
 * @returns {Promise<boolean>} true if saved, false if serializing or writing failed
 * @example
 * const isSaved = await setStorage('app.onboarding.completed', true);
 * if (!isSaved) throw new Error('Onboarding flag not saved');
 */
export async function setStorage(key, value) {
  try {
    await Preferences.set({ key, value: JSON.stringify(value ?? null) });
    return true;
  } catch (error) {
    IS_DEBUG && capStorageLogger.error('Capacitor Preferences.set(...) failed:', error);
    return false;
  }
}

export async function getStorage(key, fallback = null) {
  try {
    const { value } = await Preferences.get({ key });
    // return value ?? fallback;

    if (value === null || value === undefined) {
      return fallback;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    IS_DEBUG && capStorageLogger.error('Capacitor Preferences.get(...) failed:', error);
    return fallback;
  }
}

export async function removeStorageItem(key) {
  try {
    await Preferences.remove({ key });
  } catch (error) {
    IS_DEBUG && capStorageLogger.error('Capacitor Preferences.remove(...) failed:', error);
  }
}
