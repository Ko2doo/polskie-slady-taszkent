// -------------------------------------------------------------
// Centralized navigation history for @mateothegreat/svelte5-router.
//
// Goals:
// - Keep a REAL stack of visited routes (['/', '/map', '/about', ...])
// - Provide a routerBack() that behaves like native Android back:
//     * From /about -> /map -> /
// - Avoid "ping-pong" between two routes ("/map" <-> "/about")
//   that happens if you only store {prev, current}.
// - Work nicely with Capacitor hardware back button and Tabbar UI.
//
// How it works:
// - navigationHistoryPostHook() is registered as a global POST hook
//   in the router config. It runs AFTER every navigation.
// - It inspects the resolved path and updates the stack:
//     * FORWARD navigation: push new path
//     * BACK navigation (triggered by routerBack): pop one item
// - routerBack() only calls goto() and sets pendingPopTarget,
//   the actual stack mutation happens inside navigationHistoryPostHook()
//   once the router confirms the navigation.
// -------------------------------------------------------------

import { writable, get } from 'svelte/store';
import { goto } from '@mateothegreat/svelte5-router';

// Svelte store with navigation history.
// - stack: array of visited paths in order
// - current: current path (last item in stack)
// - prev: previous path (second to last item in stack)
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
 *      * forward navigation
 *      * back navigation (initiated by routerBack)
 *      * duplicate path (skip)
 */
export const navigationHistoryPostHook = (route) => {
  // Fallback to window.location.pathname to avoid relying
  // on internal RouteResult shape.
  /* prettier-ignore */
  const path =
    route?.path ||
    route?.result?.path?.original ||
    (typeof window !== "undefined" ? window.location.pathname : null);

  // console.log('--------------------------------------------');
  // console.log('[navPostHook] raw route =', route);
  // console.log('[navPostHook] resolved path =', path);

  // If we somehow can't resolve a path, we do nothing
  // and just allow routing to continue.
  if (!path) return true;

  navigationHistory.update((state) => {
    // if (!path) return state;
    const stack = state.stack ?? [];
    const last = stack[stack.length - 1] ?? null;

    // console.log('[navPostHook] BEFORE update state =', state);
    // console.log('[navPostHook] pendingPopTarget =', pendingPopTarget);
    // console.log('[navPostHook] last in stack =', last);

    // =========================================================
    // BACK navigation (routerBack)
    // ---------------------------------------------------------
    // If pendingPopTarget is set and the new path matches it,
    // we know this navigation was triggered by routerBack().
    // In that case we "pop" one item from the stack and recalculate
    // current/prev based on the new, shorter stack.
    // =========================================================c
    if (pendingPopTarget && path === pendingPopTarget) {
      const newStack = stack.slice(0, -1);
      const current = path;
      const prev = newStack.length >= 2 ? newStack[newStack.length - 2] : null;

      const nextState = {
        // If stack becomes empty (edge case), we still ensure there is at least
        // one element: the current path.
        stack: newStack.length ? newStack : [current],
        current,
        prev,
      };

      // console.log('[navPostHook:back] match pendingPopTarget =', pendingPopTarget);
      // console.log('[navPostHook:back] oldStack =', stack);
      // console.log('[navPostHook:back] newStack =', nextState.stack);
      // console.log('[navPostHook:back] next state =', nextState);

      // Reset the flag so the next navigation is treated as normal.
      pendingPopTarget = null;
      return nextState;
    }

    // =========================================================
    // SKIP: router resolved the same path twice in a row.
    // ---------------------------------------------------------
    // This protects us from "double updates" when router fires
    // multiple hooks for the same URL. We just keep the previous state.
    // =========================================================
    if (last === path) {
      // console.log('[navPostHook:skip] same path =', path);
      // console.log('[navPostHook:skip] state unchanged =', state);

      pendingPopTarget = null;
      return state;
    }

    if (path === '/') {
      const current = path;
      const prev = null;
      const nextState = {
        stack: [current],
        current,
        prev,
      };

      // console.log('[navPostHook:forward:root] reset stack to', nextState);

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

    // console.log('[navPostHook:forward] push path =', path);
    // console.log('[navPostHook:forward] oldStack =', stack);
    // console.log('[navPostHook:forward] newStack =', newStack);
    // console.log('[navPostHook:forward] next state =', nextState);

    // Again, reset pendingPopTarget since this is a normal navigation.
    pendingPopTarget = null;
    return nextState;
  });

  // console.log('[navPostHook] AFTER update state =', get(navigationHistory));
  // console.log('--------------------------------------------');

  // must return true to allow route evaluation to continue
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

  // console.log('============================================');
  // console.log('[routerBack] current =', current);
  // console.log('[routerBack] stack =', history);
  // console.log('[routerBack] fallback =', fallback);

  // There is a previous route in the stack -> go back to it.
  if (history.length > 1) {
    const target = history[history.length - 2]; // previous route
    pendingPopTarget = target;

    // console.log('[routerBack] go BACK to target =', target);
    // console.log('[routerBack] set pendingPopTarget =', pendingPopTarget);

    goto(target);
  } else {
    // No real history -> fallback to "/", like "go home".
    // console.log('[routerBack] no history -> goto fallback =', fallback);

    pendingPopTarget = null;
    goto(fallback);
  }

  // console.log('============================================');
}
