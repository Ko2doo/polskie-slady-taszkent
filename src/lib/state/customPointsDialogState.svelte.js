import { getStorage, setStorage } from '@/capacitor/utils/appStorage';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';
import { createToggle } from './createToggler.svelte';

const dialogInitLogger = createLogger('CustomPointsDialogState');
const DIALOG_KEY = 'app.custom_points_dialog.seen';

/**
 * State of the one-time "how custom markers work" intro dialog: whether the user has seen it
 * (persisted in Preferences) and whether it's open now.
 * @returns {{ readonly seen: boolean|null, readonly triggerValue: boolean,
 *   load: () => Promise<void>, hasSeen: () => Promise<boolean>, markCompleted: () => Promise<void>,
 *   open: () => void, close: () => void }} `seen` is null until loaded; `markCompleted`
 *   throws when the flag couldn't be saved
 * @example
 * const intro = customPointsDialogState();
 * if (!(await intro.hasSeen())) intro.open();
 */
export function customPointsDialogState() {
  // null   - value is not loaded in storage
  // true   - user marked complite
  // false  - user not marked
  let seen = $state(null);
  const trigger = createToggle();

  // Only a stored `true` counts as seen. getStorage never throws: an unreadable storage
  // returns null, so the dialog is shown
  async function load() {
    seen = (await getStorage(DIALOG_KEY)) === true;

    IS_DEBUG && dialogInitLogger.log(seen ? 'Dialog already seen - hiding dialog' : 'First time - showing dialog');
  }

  async function hasSeen() {
    if (seen === null) await load();

    return seen;
  }

  // Seen only once it is really saved, or the dialog would silently show again on the next launch.
  // Throws on failure: the caller tells the user and keeps the dialog open to try again.
  async function markCompleted() {
    const isSaved = await setStorage(DIALOG_KEY, true);

    if (!isSaved) {
      IS_DEBUG && dialogInitLogger.error('Failed to mark dialog as seen');
      throw new Error('The "custom points dialog seen" flag was not saved');
    }

    seen = true;
    IS_DEBUG && dialogInitLogger.log('Dialog marked as seen');
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
