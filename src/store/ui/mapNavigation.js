/**
 * Bottom tabbar navigation store
 */

import { writable } from 'svelte/store';

const defaults = {
  mapNavigation: false,
  modalSheet: false,
};

export const mapNavigationState = writable({ ...defaults });

export function setMapNavigation(cfg = {}) {
  mapNavigationState.set({ ...defaults, ...cfg });
}

export function patchMapNavigation(patch = {}) {
  mapNavigationState.update((upd) => ({ ...upd, ...patch }));
}

export function resetMapNavigation() {
  mapNavigationState.set({ ...defaults });
}

export function withMapNavigation(cfg = {}) {
  setMapNavigation(cfg);
  return () => resetMapNavigation();
}
