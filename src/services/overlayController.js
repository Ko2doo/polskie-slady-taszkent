// -------------------------------------------------------------
// Global overlay manager (modals, popups, sheets, dialogs, etc.)
//
// Purpose:
// - Track opened overlays in a stack (LIFO).
// - Allow Android back button to close the TOP overlay first.
// - Keep logic centralized and independent from router.
//
// Usage:
//   const id = overlayController.register(closeFn);
//   overlayController.unregister(id);
//
//   if (overlayController.tryClose()) return;
// -------------------------------------------------------------

import { writable, get } from 'svelte/store';

export const overlayState = writable({
  stack: [],
});

export const overlayController = {
  /**
   * Register overlay with a close function.
   */
  register(closeFn) {
    const id = Symbol('overlay');

    overlayState.update((state) => ({
      stack: [...(state.stack ?? []), { id, close: closeFn }],
    }));

    return id;
  },

  /**
   * Remove overlay from stack.
   */
  unregister(id) {
    overlayState.update((state) => ({
      stack: (state.stack ?? []).filter((o) => o.id !== id),
    }));
  },

  /**
   * Try to close the top overlay.
   *
   * @returns {boolean}
   *   true  -> overlay was closed
   *   false -> no overlays
   */
  tryClose() {
    const { stack } = get(overlayState);

    if (!stack?.length) return false;

    const top = stack[stack.length - 1];

    if (top?.close) {
      top.close(); // overlay сам себя закроет и unregister
      return true;
    }

    return false;
  },
};
