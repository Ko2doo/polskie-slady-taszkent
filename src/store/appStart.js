import { writable } from 'svelte/store';
import { getStorage, setStorage } from '@/capacitor/utils/appStorage';

const APP_STATE_KEY = 'app.onboarding.completed';
export const APP_FIRST_START_STATE = writable(null);

export async function initAppFirstStart() {
  try {
    const isOnboardingCompleted = await getStorage(APP_STATE_KEY);

    if (isOnboardingCompleted === undefined || isOnboardingCompleted === null) {
      APP_FIRST_START_STATE.set(true);
      return;
    }

    if (isOnboardingCompleted === true) {
      APP_FIRST_START_STATE.set(false);
      return;
    }

    APP_FIRST_START_STATE.set(true);
  } catch (error) {
    console.error('Failed to initialize app first start state:', error);
    APP_FIRST_START_STATE.set(true);
  }
}

export async function markFirstStartCompleted() {
  try {
    await setStorage(APP_STATE_KEY, true);
    APP_FIRST_START_STATE.set(false);
  } catch (error) {
    console.error('Failed to mark onboarding as completed:', error);
    throw error;
  }
}
