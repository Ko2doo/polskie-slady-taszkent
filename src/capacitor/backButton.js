// -------------------------------------------------------------
// Android hardware back button integration for Capacitor + Svelte.
//
// This file is part of a larger navigation & UX system that includes:
//
// 1) navigationHistoryHook.js
//    - Exports:
//        * navigationHistory (Svelte store with { stack, current, prev })
//        * navigationHistoryPostHook (global router post hook)
//        * routerBack(fallback)
//    - Keeps a REAL stack of visited routes: ['/', '/map', '/about', ...].
//    - Distinguishes between forward and back navigation.
//    - Resets the stack to ['/'] on any forward navigation to "/",
//      so that pressing back on the home route never returns to
//      a previous page (like "/map").
//
// 2) toastController.js
//    - Exports:
//        * exitToast (Svelte store: { opened, durationMs, version })
//        * toastController.showExitToast(durationMs?)
//    - Controls the global "exit" toast, shown when user presses back
//      on the root ("/") for the first time.
//    - Duration (durationMs) is used to drive the countdown UI and
//      should match the EXIT_WINDOW_MS here.
//
// 3) ExitToast.svelte (or similar)
//    - Subscribes to exitToast store and renders a KonstaUI <Toast>.
//    - Shows a message like: "Press back again to minimize the app"
//      plus a visual countdown.
//    - Auto-hides after durationMs and restarts its timer if the user
//      taps the toast (toastController.showExitToast(...) is called again).
//
// Together, these pieces implement a consistent Android-like back behavior:
//   - Navigate back through screens using the router stack.
//   - Go to the home route ("/") when there is no more history.
//   - Require a double back press on the home route to minimize the app,
//     where the second press must happen within a specific time window
//     (EXIT_WINDOW_MS), aligned with the toast countdown.
// -------------------------------------------------------------

// Capacitor
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Svelte / router
import { get } from 'svelte/store';
import { navigationHistory, routerBack } from '@/services/navigationHistoryHook';
import { goto } from '@mateothegreat/svelte5-router';
import { toastController } from '@/services/toastController';

// Exit window must match the toast countdown duration.
// Example: 3000ms = 3s visual countdown in ExitToast.svelte.
const EXIT_WINDOW_MS = 3000;

// Timestamp of the last "back" press on "/".
// 0 means "no active exit window" (i.e. next back press will open the toast).
let lastBackTime = 0;

// Internal flag to avoid attaching multiple listeners.
// initBackButtonHandler() may be called from App.svelte on mount,
// and we want to ensure only ONE backButton listener is registered.
let backHandlerAttached = false;

/**
 * Initialize Android hardware back button handling.
 *
 * This should be called once, typically in App.svelte onMount().
 *
 * Behavior:
 * - If navigationHistory.stack has more than 1 entry:
 *     -> use routerBack('/') to go to the previous route in the stack.
 * - If stack length is 1 and current !== '/':
 *     -> treat back as "go home" and navigate to '/'.
 * - If stack length is 1 and current === '/':
 *     -> use a time-based double-back behavior:
 *          * first press  -> show exit Toast (toastController.showExitToast())
 *                           and start an "exit window" timer (EXIT_WINDOW_MS)
 *          * second press -> if within the exit window -> App.minimizeApp()
 *                         -> if outside the window     -> treat as first press again
 */
export function initBackButtonHandler() {
  // Guard: only run on native platforms (Android/iOS), not in a browser.
  if (!Capacitor.isNativePlatform()) return;

  // Guard: Android only. iOS has different back gesture semantics.
  if (Capacitor.getPlatform() !== 'android') return;

  // Prevent multiple listener registrations.
  if (backHandlerAttached) return;
  backHandlerAttached = true;

  // Register a single listener for the Android hardware back button.
  App.addListener('backButton', () => {
    const { stack, current } = get(navigationHistory);
    const depth = stack?.length ?? 0;

    // 1) There is navigation history (more than 1 entry in the stack):
    //    -> go "back" using routerBack().
    //    routerBack() will:
    //      - compute the previous path from the stack
    //      - call goto() to navigate there
    //      - let navigationHistoryPostHook "pop" the stack
    //
    //    We also reset lastBackTime, because once we leave the root
    //    route, the "exit window" no longer makes sense.
    if (depth > 1) {
      lastBackTime = 0;
      routerBack('/');

      return;
    }

    // 2) No history (stack length <= 1) and we are NOT on the home route:
    //    -> treat this as "go home" and navigate to "/".
    //    This is similar to many Android apps that bring you back to the
    //    main screen before exiting/minimizing.
    if (current !== '/') {
      lastBackTime = 0;
      goto('/');

      return;
    }

    // 3) We are on "/" and there is no more history (depth <= 1):
    //    This is where we implement the time-based "double-back to exit"
    //    behavior, aligned with the toast countdown.
    //
    //    - First back (no active window OR window expired):
    //        * record lastBackTime = now
    //        * show toast for EXIT_WINDOW_MS (e.g. 3 seconds)
    //
    //    - Second back within EXIT_WINDOW_MS:
    //        * minimize the app
    //
    //    - Second back after EXIT_WINDOW_MS:
    //        * treated as a new "first back" -> show toast again.
    const now = Date.now();
    const diff = now - lastBackTime;

    // No active window OR window expired -> first press.
    if (!lastBackTime || diff > EXIT_WINDOW_MS) {
      lastBackTime = now;
      toastController.showExitToast(EXIT_WINDOW_MS);

      return;
    }

    // Second press within the active exit window -> minimize app.
    lastBackTime = 0;
    App.minimizeApp();
  });
}
