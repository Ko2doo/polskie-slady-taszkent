import { writable, get } from 'svelte/store';
import { goto } from '@mateothegreat/svelte5-router';

// Simple stack or pair;
export const navigationHistory = writable({
  current: null,
  prev: null,
});

/**
 * Global post hook for @mateothegreat/svelte5-router.
 * Should be registered in router config as a global post hook.
 */
export const navigationHistoryPostHook = (route) => {
  // Fallback to window.location.pathname to avoid relying
  // on internal RouteResult shape.
  /* prettier-ignore */
  const path =
    route?.path ||
    route?.result?.path?.original ||
    (typeof window !== "undefined" ? window.location.pathname : null);

  // console.log(route?.result?.path?.original);
  // console.log('[navPostHook] route.path =', route?.result?.path?.original, 'resolved path =', path);

  navigationHistory.update((state) => {
    if (!path) return state;

    if (state.current == null) {
      const next = { prev: null, current: path };

      // console.log('[navPostHook:init] path =', path, 'next =', next);
      return next;
    }

    if (state.current === path) {
      // console.log('[navPostHook:skip] same path =', path, 'state =', state);
      return state;
    }

    const next = {
      prev: state.current,
      current: path,
    };

    // console.log('[navPostHook:update] path =', path, 'next =', next);
    return next;
  });

  // must return true to allow route evaluation to continue
  return true;
};

/**
 * Router-friendly "back":
 * navigates via goto() to the previous route or fallback ("/").
 */
export function routerBack(fallback = '/') {
  const { prev, current } = get(navigationHistory);
  // console.log('[routerBack] prev =', prev, 'current =', current);

  if (prev && prev !== current) {
    goto(prev);
  } else {
    goto(fallback);
  }
}
