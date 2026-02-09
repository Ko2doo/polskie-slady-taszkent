import { writable } from 'svelte/store';
import { getStorage, setStorage } from '../utils/appStorage';

const APP_STATE_KEY = 'app.firstStart';
export const APP_FIRST_START_STATE = writable(null);

export async function initAppFirstStart() {
  const stored = await getStorage(APP_STATE_KEY);

  if (stored === null) {
    console.log('[App] App state is:', stored);

    await setStorage(APP_STATE_KEY, false);
    APP_FIRST_START_STATE.set(true);

    return;
  }

  APP_FIRST_START_STATE.set(stored === true);
}

export async function markFirstStartCompleted() {
  await setStorage(APP_STATE_KEY, false);
  APP_FIRST_START_STATE.set(false);
}
