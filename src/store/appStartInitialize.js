import { writable } from 'svelte/store';
import { getStorage, setStorage } from '@/capacitor/utils/appStorage';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const appInitLogger = createLogger('AppFirstStart');

const APP_FIRST_LAUNCH_KEY = 'app.onboarding.completed';
export const APP_FIRST_LAUNCH_STORAGE_VAL = writable(null);

/**
 * Initializes first app launch state
 * - If onboarding not completed > show dialog
 * - If already completed > hide
 * - Supports migration from old key
 */
export async function initFirstLaunch() {
  // getStorage never throws: an unreadable storage returns null, so the onboarding is shown
  const isOnboardingCompleted = await getStorage(APP_FIRST_LAUNCH_KEY);

  // First launch - onboarding not completed
  if (isOnboardingCompleted === undefined || isOnboardingCompleted === null || isOnboardingCompleted === false) {
    APP_FIRST_LAUNCH_STORAGE_VAL.set(true); // Show window
    IS_DEBUG && appInitLogger.log('🎉 First start detected - showing welcome dialog');
    return;
  }

  // Onboarding already completed
  if (isOnboardingCompleted === true) {
    APP_FIRST_LAUNCH_STORAGE_VAL.set(false); // Hide window
    IS_DEBUG && appInitLogger.log('✅ Onboarding already completed - hiding welcome dialog');
  }
}

/**
 * Mark the onboarding as completed and hide it. The wizard is hidden only once the flag is really
 * saved — otherwise it would come back on the next launch for no visible reason.
 * @throws {Error} when the flag could not be saved: the wizard tells the user and stays open
 *   so they can try again
 */
export async function markFirstLaunchCompleted() {
  const isSaved = await setStorage(APP_FIRST_LAUNCH_KEY, true);

  if (!isSaved) {
    IS_DEBUG && appInitLogger.error('Failed to mark onboarding as completed');
    throw new Error('The onboarding flag was not saved');
  }

  APP_FIRST_LAUNCH_STORAGE_VAL.set(false);
  IS_DEBUG && appInitLogger.log('✅ Onboarding marked as completed');
}
