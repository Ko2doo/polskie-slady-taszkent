import { getStorage, setStorage } from '@/capacitor/utils/appStorage';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';
import { createToggle } from './createToggler.svelte';

const dialogInitLogger = createLogger('CustomPointsDialogState');
const DIALOG_KEY = 'app.custom_points_dialog.seen';

export function customPointsDialogState() {
  // null   - value is not loaded in storage
  // true   - user marked complite
  // false  - user not marked
  let seen = $state(null);
  const trigger = createToggle();

  async function load() {
    try {
      const isDialogCompleted = await getStorage(DIALOG_KEY);

      if (isDialogCompleted === true) {
        seen = true;
        IS_DEBUG && dialogInitLogger.log('Dialog start detected - showing dialog');

        return;
      } else {
        seen = false;
        IS_DEBUG && dialogInitLogger.log('Dialog already seen - hiding dialog');

        return;
      }
    } catch (error) {
      IS_DEBUG && dialogInitLogger.error('Failed to initialize dialog frist start state:', error);
      seen = false;
    }
  }

  async function hasSeen() {
    if (seen === null) await load();

    return seen;
  }

  async function markCompleted() {
    try {
      await setStorage(DIALOG_KEY, true);
      seen = true;

      IS_DEBUG && dialogInitLogger.log('Dialog marked as seen');
    } catch (error) {
      IS_DEBUG && dialogInitLogger.error('Failed to mark dialog as seen:', error);
      throw error;
    }
  }

  function open() {
    return trigger.open();
  }

  function close() {
    return trigger.close();
  }

  return {
    get seen() {
      return seen;
    },

    get triggerValue() {
      return trigger.value;
    },

    open,
    close,
    load,
    hasSeen,
    markCompleted,
  };
}
