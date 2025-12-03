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
//    - Keeps a REAL stack of visited routes: ['/', '/map', '/about', ...]
//    - Distinguishes between "forward" navigation and "back" navigation.
//    - routerBack() uses that stack to emulate native Android back
//      (go to previous route instead of just storing {prev, current}).
//
// 2) toastController.js
//    - Exports:
//        * exitToast (Svelte store: boolean)
//        * toastController.showExitToast()
//    - Controls the global "exit" toast, shown when user presses back
//      on the root ("/") for the first time.
//    - The UI for this toast is implemented in a dedicated Svelte component.
//
// 3) ExitToast.svelte (or similar)
//    - Subscribes to exitToast store and renders a KonstaUI <Toast>.
//    - Typical text: "Press back again to minimize the app" (or localized).
//    - Placed once in the root layout (e.g. App.svelte) so it is always
//      available when toastController.showExitToast() is called.
//
// Together, these pieces implement a consistent Android-like back behavior:
//   - Navigate back through screens using the router stack
//   - Go to the home route ("/") when there is no more history
//   - Require a double back press on the home route to minimize the app.
// -------------------------------------------------------------

// Capacitor
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

// Svelte / router
import { get } from 'svelte/store';
import { navigationHistory, routerBack } from '@/services/navigationHistoryHook';
import { goto } from '@mateothegreat/svelte5-router';
import { toastController } from '@/services/toastController';

// Exit window must match the toast countdown duration
const EXIT_WINDOW_MS = 3000;

// Timestamp of the last "back" press on "/".
// 0 means "no active exit window".
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
 *     -> require double back:
 *          * first press  -> show exit Toast (toastController.showExitToast())
 *          * second press -> App.minimizeApp()
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

    // 1) If there is navigation history (more than 1 entry in the stack),
    //    we simply go "back" using routerBack().
    //    routerBack() will:
    //      - compute the previous path from the stack
    //      - call goto() to navigate there
    //      - let navigationHistoryPostHook "pop" the stack
    if (depth > 1) {
      lastBackTime = 0;
      routerBack('/');

      return;
    }

    // 2) No history (stack length <= 1) and we are NOT on the home route:
    //    treat this as "go home" and navigate to "/".
    //    This is similar to many Android apps that bring you back to the
    //    main screen before exiting/minimizing.
    if (current !== '/') {
      lastBackTime = 0;
      goto('/');

      return;
    }

    // 3) We are on "/" and there is no more history:
    //    This is where we implement the "double-back to exit/minimize" UX.
    const now = Date.now();
    const diff = now - lastBackTime;

    if (!lastBackTime || diff > EXIT_WINDOW_MS) {
      lastBackTime = now;
      toastController.showExitToast(EXIT_WINDOW_MS);

      return;
    }

    // 4) Second back on "/" -> minimize app.
    lastBackTime = 0;
    App.minimizeApp();
  });
}
