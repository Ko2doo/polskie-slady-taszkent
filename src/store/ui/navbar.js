/**
 * Navbar state store
 * title: string title
 * showSidePanel: show/hide icon side panel
 * showFavorites: show/hide icon favorites
 */

import { writable } from 'svelte/store';

// defaults
const defaults = {
  title: '',
  showSidePanel: false,
  showFavorites: false,
};

// State
export const navbarState = writable({ ...defaults });

// Set store
export function setNavbar(cfg = {}) {
  navbarState.set({ ...defaults, ...cfg });
}

// Update store
export function patchNavbar(patch = {}) {
  navbarState.update((nb) => ({ ...nb, ...patch }));
}

// Reset store
export function resetNavbar() {
  navbarState.set({ ...defaults });
}

export function withNavbar(cfg = {}) {
  setNavbar(cfg);
  return () => resetNavbar();
}

// export const navbarState = writable({
//   title: '',
//   showSidePanel: false,
//   showFavorites: false,
// });

// // Helper
// export function setNavbar(config = {}) {
//   // defaults
//   navbarState.set({
//     title: config.title ?? '',
//     showSidePanel: config.showSidePanel ?? false,
//     showFavorites: config.showFavorites ?? false,
//   });
// }
