// -------------------------------------------------------------
// Centralized navigation history for @mateothegreat/svelte5-router.
//
// Goals:
// - Keep a REAL stack of visited routes (['/', '/map', '/about', ...]).
// - Provide a routerBack() that behaves like native Android back:
//     * /about -> /map -> /
// - Avoid "ping-pong" between two routes ("/map" <-> "/about")
//   that happens if you only store { prev, current }.
// - Work nicely with:
//     * Capacitor hardware back button (backButton.js)
//     * Tabbar UI (bottom navigation).
//
// How it works:
// - navigationHistoryPostHook() is registered as a global POST hook
//   in the router config. It runs AFTER every navigation.
// - It derives a normalized path string from the router result.
// - It updates navigationHistory with a proper stack based on the path:
//     * BACK navigation (triggered by routerBack): pop one item
//     * FORWARD navigation: push new path
//     * Special case for "/": reset the stack to ['/']
//     * Duplicate path: skip (do not change state)
// - routerBack() does NOT mutate the stack directly.
//   Instead it:
//     * computes the "previous" path from the stack
//     * sets pendingPopTarget to that path
//     * calls goto(target)
//
//   Then, when the router finishes navigating to target,
//   navigationHistoryPostHook() sees that path === pendingPopTarget
//   and applies the "back" logic (pop stack).
//
// This module is tightly coupled with backButton.js:
// - backButton.js uses navigationHistory.stack length ("depth") and
//   navigationHistory.current to decide whether to:
//     * go back in history
//     * go "home" ("/")
//     * or trigger the "double-back to exit" behavior on "/".
// -------------------------------------------------------------

import { writable, get } from 'svelte/store';
import { goto } from '@mateothegreat/svelte5-router';

// Svelte store with navigation history.
// - stack: array of visited paths in order
// - current: current path (last item in stack)
// - prev: previous path (second-to-last item in stack)
export const navigationHistory = writable({
  stack: [],
  current: null,
  prev: null,
});

// Flag telling the post hook that the *next* navigation
// is intended to be "back" (routerBack), not a regular forward navigation.
// We store the expected target path here and check it inside the hook.
let pendingPopTarget = null;

/**
 * Global post hook for @mateothegreat/svelte5-router.
 *
 * This function MUST be registered in the router config as a global post hook.
 * It:
 *  - derives a normalized path string from the route object
 *  - updates the navigationHistory store with a proper stack
 *  - distinguishes between:
 *      * back navigation (initiated by routerBack)
 *      * forward navigation (tabs, links, goto, etc.)
 *      * duplicate path (skip)
 *      * special handling for the root path "/"
 */
export const navigationHistoryPostHook = (route) => {
  // Fallback to window.location.pathname to avoid relying
  // on internal RouteResult shape.
  /* prettier-ignore */
  const path =
    route?.path ||
    route?.result?.path?.original ||
    (typeof window !== "undefined" ? window.location.pathname : null);

  // If we somehow can't resolve a path, we do nothing
  // and just allow routing to continue.
  if (!path) return true;

  navigationHistory.update((state) => {
    // if (!path) return state;
    const stack = state.stack ?? [];
    const last = stack[stack.length - 1] ?? null;

    // =========================================================
    // BACK navigation (routerBack)
    // ---------------------------------------------------------
    // If pendingPopTarget is set and the new path matches it,
    // we know this navigation was triggered by routerBack().
    // In that case we "pop" one item from the stack and recalculate
    // current/prev based on the new, shorter stack.
    // =========================================================
    if (pendingPopTarget && path === pendingPopTarget) {
      const newStack = stack.slice(0, -1);
      const current = path;
      const prev = newStack.length >= 2 ? newStack[newStack.length - 2] : null;

      const nextState = {
        // If the stack becomes empty (edge case), we still ensure
        // there is at least one element: the current path.
        stack: newStack.length ? newStack : [current],
        current,
        prev,
      };

      // Reset the flag so the next navigation is treated as normal.
      pendingPopTarget = null;
      return nextState;
    }

    // =========================================================
    // SKIP: router resolved the same path twice in a row.
    // ---------------------------------------------------------
    // This protects us from "double updates" when the router fires
    // multiple hooks for the same URL. We just keep the previous state.
    // =========================================================
    if (last === path) {
      pendingPopTarget = null;
      return state;
    }

    // =========================================================
    // SPECIAL CASE: root path "/"
    // ---------------------------------------------------------
    // Any forward navigation to "/" (tab click, goto('/'), etc.)
    // is treated as a "reset" of the history:
    //
    //   stack = ['/']
    //   current = '/'
    //   prev = null
    //
    // This guarantees that pressing Android back on "/"
    // will NOT take the user back to a previous page (e.g. "/map"),
    // and instead backButton.js can safely apply the
    // "double-back to exit" behavior.
    // =========================================================
    if (path === '/') {
      const current = path;
      const prev = null;
      const nextState = {
        stack: [current],
        current,
        prev,
      };

      pendingPopTarget = null;
      return nextState;
    }

    // =========================================================
    // FORWARD navigation
    // ---------------------------------------------------------
    // Normal navigation (e.g. user tapped a tab, link, button, or goto()).
    // We push the path onto the stack and update current/prev.
    // =========================================================
    const newStack = [...stack, path];
    const current = path;
    const prev = newStack.length >= 2 ? newStack[newStack.length - 2] : null;

    const nextState = {
      stack: newStack,
      current,
      prev,
    };

    // Reset pendingPopTarget since this is a normal forward navigation.
    pendingPopTarget = null;
    return nextState;
  });

  // Must return true to allow route evaluation to continue.
  return true;
};

/**
 * Router-friendly "back" based on the navigation stack.
 *
 * Behavior:
 *  - If we have at least 2 entries in the stack:
 *      * Navigate to the previous entry (stack[length - 2])
 *      * Mark that target as pendingPopTarget so the post hook
 *        knows this is a BACK navigation and will pop the stack.
 *  - If there is no history (stack length <= 1):
 *      * Navigate to fallback (usually "/")
 *
 * This function should be used instead of manually calling goto(prev),
 * because it keeps the stack consistent and avoids "ping-pong" between
 * two routes.
 */
export function routerBack(fallback = '/') {
  const { stack, current } = get(navigationHistory);
  const history = stack ?? [];

  // There is a previous route in the stack -> go back to it.
  if (history.length > 1) {
    const target = history[history.length - 2]; // previous route
    pendingPopTarget = target;

    goto(target);
  } else {
    // No real history -> fallback to "/", like "go home".

    pendingPopTarget = null;
    goto(fallback);
  }
}
