/**
 * setStorage, getStorage helpers
 * API info: https://capacitorjs.com/docs/apis/preferences
 */

import { Preferences } from '@capacitor/preferences';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const capStorageLogger = createLogger('Storage');

export async function setStorage(key, value) {
  try {
    /*prettier-ignore*/
    const serialized = typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

    await Preferences.set({ key, value: serialized });
  } catch (error) {
    IS_DEBUG && capStorageLogger.error('Capacitor Preferences.set(...) failed:', error);
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
