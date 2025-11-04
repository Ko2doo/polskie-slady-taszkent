/**
 * Navbar State Store (Svelte 5, KonstaUI)
 *
 * Purpose:
 * - Provide a global, declarative way for pages/components to configure the top <Navbar/>.
 * - Keep the Navbar mounted in App.svelte and let pages request: title, side-panel button, favorites button, etc.
 * - Offer full replacement (`setNavbar`), partial updates (`patchNavbar`), and lifecycle-safe apply/cleanup (`withNavbar`).
 *
 * How to use (high level):
 * - In App.svelte, bind <Navbar/> props and slots to `$navbarState` (Variant A: read store directly in template).
 * - In each page, call `withNavbar({...})` inside a `$effect` to define title and which buttons to show.
 * - Optionally call `patchNavbar({...})` to tweak a single flag without resetting everything.
 */

import { writable } from 'svelte/store';

/**
 * @typedef {Object} NavbarState
 * @property {string} title
 * @property {boolean} showSidePanel
 * @property {boolean} showFavorites
 */

const defaults = /** @type {NavbarState} */ ({
  title: '',
  showSidePanel: false,
  showFavorites: false,
});

/** @type {import('svelte/store').Writable<NavbarState>} */
export const navbarState = writable({ ...defaults });

// Role: Replace the entire navbar profile (title & flags) with sensible defaults + overrides.
export function setNavbar(cfg = {}) {
  navbarState.set({ ...defaults, ...cfg });
}
/**
 * Set the whole Navbar state at once (full replacement).
 *
 * Recommended when a page first mounts and wants a clean, explicit profile.
 *
 * @param {Partial<NavbarState>} [cfg]
 * @example
 * // In a page component:
 * $effect(() => {
 *   const title = $i18n.t('ui:navbar:handbook:title');
 *   setNavbar({
 *     title: title || 'Handbook',
 *     showSidePanel: true,
 *     showFavorites: false,
 *   });
 * });
 */

// Role: Partially update the navbar without resetting other fields.
export function patchNavbar(patch = {}) {
  navbarState.update((nb) => ({ ...nb, ...patch }));
}
/**
 * Partially patch the Navbar state.
 *
 * Useful for fine-grained toggles (e.g., enabling favorites button) without touching the title.
 *
 * @param {Partial<NavbarState>} [patch]
 * @example
 * // Toggle favorites icon on:
 * patchNavbar({ showFavorites: true });
 *
 * // Change only the title text:
 * patchNavbar({ title: 'New Title' });
 */

// Role: Reset the navbar to its defaults (blank title, all flags off).
export function resetNavbar() {
  navbarState.set({ ...defaults });
}
/**
 * Reset Navbar state back to defaults.
 *
 * Useful when leaving a page or ensuring a known baseline.
 *
 * @example
 * resetNavbar();
 */

// Role: Apply a navbar profile for the current scope and auto-reset on unmount.
export function withNavbar(cfg = {}) {
  setNavbar(cfg);
  return () => resetNavbar();
}
/**
 * Declaratively apply a Navbar profile and return a disposer to reset it on cleanup.
 *
 * Use inside a `$effect` and return the disposer to ensure automatic reset on route/language changes.
 *
 * @param {Partial<NavbarState>} [cfg]
 * @returns {() => void} disposer that resets the navbar to defaults
 * @example
 * // In a page component (Svelte 5 runes):
 * let { route } = $props();
 * $effect(() => {
 *   const key = resolvePageKeyFromRouteResult(route?.result);
 *   const lang = $i18n.language; // ensure re-run on language change
 *   const title = key ? $i18n.t(`ui:navbar:${key}:title`) : '';
 *
 *   const dispose = withNavbar({
 *     title: title || key,
 *     showSidePanel: key !== 'home',
 *     showFavorites: key === 'handbook',
 *   });
 *
 *   return dispose; // auto reset on unmount / dep change
 * });
 *
 * // Later, tweak only one flag:
 * // patchNavbar({ showFavorites: true });
 */
