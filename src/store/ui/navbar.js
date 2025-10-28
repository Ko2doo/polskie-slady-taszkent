/**
 * Navbar state store
 * title: string title
 * showSearch: show/hide icon searching
 * showFavorites: show/hide icon favorites
 */

import { writable } from 'svelte/store';

export const navbarState = writable({
  title: '',
  showSearch: false,
  showFavorites: false,
});

// Helper
export function setNavbar(config = {}) {
  // defaults
  navbarState.set({
    title: config.title ?? '',
    showSearch: config.showSearch ?? false,
    showFavorites: config.showFavorites ?? false,
  });
}
