/**
 * setStorage, getStorage helpers
 * API info: https://capacitorjs.com/docs/apis/preferences
 */

import { Preferences } from '@capacitor/preferences';

export async function setStorage(key, value) {
  try {
    await Preferences.set({ key, value: String(value) });
  } catch (error) {
    console.error('Capacitor Preferences.set(...) failed:', error);
  }
}

export async function getStorage(key, fallback = null) {
  try {
    const { value } = await Preferences.get({ key });
    // return value ?? fallback;

    if (value === null || value === undefined) {
      return fallback;
    }

    return value;
  } catch (error) {
    console.error('Capacitor Preferences.get(...) failed:', error);
    return fallback;
  }
}

export async function removeStorageItem(key) {
  try {
    await Preferences.remove({ key });
  } catch (error) {
    console.error('Capacitor Preferences.remove(...) failed:', error);
  }
}
