/**
 * Bottom Navigation Bar store
 */

import { writable } from 'svelte/store';

const defaults = { isVisible: true };

export const bottomTabbarState = writable({ ...defaults });

export function setTabbar(cfg = {}) {
  bottomTabbarState.set({ ...defaults, ...cfg });
}

export function patchTabbar(patch = {}) {
  bottomTabbarState.update((nb) => ({ ...nb, ...patch }));
}

export function resetTabbar() {
  bottomTabbarState.set({ ...defaults });
}

export function withTabbar(cfg = {}) {
  setTabbar(cfg);
  return () => resetTabbar();
}
