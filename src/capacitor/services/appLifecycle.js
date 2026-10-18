/**
 * App lifecycle (Capacitor App plugin): the app going to the background, where the system may
 * kill it at any moment — the last chance to write what's still waiting to be saved.
 *
 * The back button, also an App plugin event, has its own wrapper: `capacitor/backButton.js`.
 */

import { App } from '@capacitor/app';

/**
 * Call `callback` every time the app goes to the background.
 *
 * @param {() => void} callback - what to do on the way to the background (save, flush)
 * @returns {() => Promise<void>} removes the listener
 *
 * @example
 * const stopListening = onAppBackground(() => customPointsState.flush());
 * // only if it must stop before the app ends:
 * await stopListening();
 */
export function onAppBackground(callback) {
  const listener = App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) callback();
  });

  return async () => {
    const handle = await listener;
    await handle?.remove();
  };
}
