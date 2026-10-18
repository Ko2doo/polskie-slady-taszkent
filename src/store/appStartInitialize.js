import { writable } from 'svelte/store';
import { getStorage, setStorage } from '@/capacitor/utils/appStorage';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const appInitLogger = createLogger('AppFirstStart');

const APP_FIRST_LAUNCH_KEY = 'app.onboarding.completed';
export const APP_FIRST_LAUNCH_STORAGE_VAL = writable(null);

/**
 * Initializes the first-launch state: the onboarding is shown unless the stored flag is exactly
 * `true`. Any other value — nothing stored, `false`, or something unexpected written by another
 * version or by hand — shows it, so the user can never end up with no onboarding and no
 * completed flag.
 * @returns {Promise<void>}
 */
export async function initFirstLaunch() {
  // getStorage never throws: an unreadable storage returns null, so the onboarding is shown
  const isOnboardingCompleted = (await getStorage(APP_FIRST_LAUNCH_KEY)) === true;

  APP_FIRST_LAUNCH_STORAGE_VAL.set(!isOnboardingCompleted);

  IS_DEBUG &&
    appInitLogger.log(
      isOnboardingCompleted
        ? '✅ Onboarding already completed - hiding welcome dialog'
        : '🎉 First start detected - showing welcome dialog',
    );
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
