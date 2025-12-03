// -------------------------------------------------------------
// Global controller for the "exit" toast used by the Android
// back button logic.
//
// exitToast store structure:
//   {
//     opened: boolean,    // whether toast is visible
//     durationMs: number, // total duration in ms for auto-hide
//     version: number,    // increments on each show to restart countdown
//   }
//
// toastController.showExitToast(durationMs?):
//   - opens the toast
//   - sets (or updates) the duration
//   - increments version to signal "restart countdown"
//
// toastController.hide():
//   - closes the toast (opened = false)
//
// The actual countdown timer and UI are implemented in ExitToast.svelte.
// -------------------------------------------------------------

import { writable } from 'svelte/store';

// Default toast state
const DEFAULT_DURATION_MS = 3000;

export const exitToast = writable({
  opened: false,
  durationMs: DEFAULT_DURATION_MS,
  version: 0,
});

export const toastController = {
  /**
   * Show (or re-show) the exit toast.
   *
   * @param {number} durationMs - Optional custom duration in ms.
   *                              Defaults to DEFAULT_DURATION_MS.
   */
  showExitToast(durationMs = DEFAULT_DURATION_MS) {
    exitToast.update((state) => ({
      opened: true,
      durationMs,
      // bump version so the UI knows it must restart the countdown
      version: state.version + 1,
    }));
  },

  /**
   * Hide the exit toast.
   */
  hide() {
    exitToast.update((state) => ({
      ...state,
      opened: false,
    }));
  },
};
