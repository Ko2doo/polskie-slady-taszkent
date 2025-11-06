/**
 * Navbar State Store (Svelte 5, KonstaUI)
 *
 */

import { writable } from 'svelte/store';

const defaults = {
  title: '',
  leftSnippet: null, // () => any
  rightSnippet: null, // () => any
  subnavSnippet: null, // () => any
};

export const navbarState = writable({ ...defaults });

// Role: Replace the entire navbar profile (title & flags) with sensible defaults + overrides.
export function setNavbar(cfg = {}) {
  navbarState.set({ ...defaults, ...cfg });
}

// Role: Partially update the navbar without resetting other fields.
export function patchNavbar(patch = {}) {
  navbarState.update((nb) => ({ ...nb, ...patch }));
}

// Role: Reset the navbar to its defaults (blank title, all flags off).
export function resetNavbar() {
  navbarState.set({ ...defaults });
}

// Role: Apply a navbar profile for the current scope and auto-reset on unmount.
export function withNavbar(cfg = {}) {
  setNavbar(cfg);
  return () => resetNavbar();
}
