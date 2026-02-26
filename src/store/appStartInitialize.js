import { writable } from 'svelte/store';
import { getStorage, setStorage } from '@/capacitor/utils/appStorage';

const APP_FIRST_LAUNCH_KEY = 'app.onboarding.completed';
export const APP_FIRST_LAUNCH_STORAGE_VAL = writable(null);

/**
 * Initializes first app launch state
 * - If onboarding not completed > show dialog
 * - If already completed > hide
 * - Supports migration from old key
 */
export async function initFirstLaunch() {
  try {
    // Check new key
    const isOnboardingCompleted = await getStorage(APP_FIRST_LAUNCH_KEY);

    // First launch - onboarding not completed
    if (isOnboardingCompleted === undefined || isOnboardingCompleted === null || isOnboardingCompleted === false) {
      APP_FIRST_LAUNCH_STORAGE_VAL.set(true); // Show window
      console.log('🎉 First start detected - showing welcome dialog');
      return;
    }

    // Onboarding already completed
    if (isOnboardingCompleted === true) {
      APP_FIRST_LAUNCH_STORAGE_VAL.set(false); // Hide window
      console.log('✅ Onboarding already completed - hiding welcome dialog');
      return;
    }
  } catch (error) {
    console.error('Failed to initialize app first start state:', error);
    APP_FIRST_LAUNCH_STORAGE_VAL.set(true);
  }
}

export async function markFirstLaunchCompleted() {
  try {
    await setStorage(APP_FIRST_LAUNCH_KEY, true);
    APP_FIRST_LAUNCH_STORAGE_VAL.set(false);
    console.log('✅ Onboarding marked as completed');
  } catch (error) {
    console.error('Failed to mark onboarding as completed:', error);
    throw error;
  }
}
