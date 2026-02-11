import { writable } from 'svelte/store';
import { getStorage, setStorage } from '@/capacitor/utils/appStorage';

const APP_STATE_KEY = 'app.onboarding.completed';
export const APP_FIRST_START_STATE = writable(null);

/**
 * Initializes first app launch state
 * - If onboarding not completed → show dialog
 * - If already completed → hide
 * - Supports migration from old key
 */
export async function initAppFirstStart() {
  try {
    // Check new key
    const isOnboardingCompleted = await getStorage(APP_STATE_KEY);

    // First launch - onboarding not completed
    if (isOnboardingCompleted === undefined || isOnboardingCompleted === null || isOnboardingCompleted === false) {
      APP_FIRST_START_STATE.set(true); // Show window
      console.log('🎉 First start detected - showing welcome dialog');
      return;
    }

    // Onboarding already completed
    if (isOnboardingCompleted === true) {
      APP_FIRST_START_STATE.set(false); // Hide window
      console.log('✅ Onboarding already completed - hiding welcome dialog');
      return;
    }
  } catch (error) {
    console.error('Failed to initialize app first start state:', error);
    APP_FIRST_START_STATE.set(true);
  }
}

export async function markFirstStartCompleted() {
  try {
    await setStorage(APP_STATE_KEY, true);
    APP_FIRST_START_STATE.set(false);
    console.log('✅ Onboarding marked as completed');
  } catch (error) {
    console.error('Failed to mark onboarding as completed:', error);
    throw error;
  }
}
