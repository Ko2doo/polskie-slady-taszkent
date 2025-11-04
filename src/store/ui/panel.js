/**
 * Panel Store Utilities (Svelte 5, KonstaUI)
 *
 * Purpose:
 * - Provide a single global source of truth for an application-wide sliding Panel (KonstaUI <Panel/>).
 * - Centralize open/close state, side, backdrop/floating behavior, title, and dynamic content.
 * - Allow pages/components to declaratively set a "panel profile" and clean it up on unmount.
 *
 * How to use (high level):
 * - Mount one <Panel> shell in App.svelte and bind its props to `$panelState`.
 * - On each page, call `withPanel({...})` inside a `$effect` to define panel content & behavior.
 * - Open/close programmatically via `openPanel()` / `closePanel()`, or via UI buttons.
 *
 */

import { writable } from 'svelte/store';

/**
 * @typedef {Object} PanelContent
 * @property {any} component - A Svelte component constructor to render inside the panel.
 * @property {Record<string, any>=} props - Props object passed to the component.
 */

/**
 * @typedef {Object} PanelState
 * @property {boolean} isOpen
 * @property {'left'|'right'} side
 * @property {boolean} backdrop
 * @property {boolean} floating
 * @property {string} title
 * @property {PanelContent|null} content
 */

const defaults = /** @type {PanelState} */ ({
  isOpen: false,
  side: 'left', // 'left' | 'right'
  backdrop: true,
  floating: true,
  title: '',
  content: null, // {component, props} | null
});

/** @type {import('svelte/store').Writable<PanelState>} */
export const panelState = writable({ ...defaults });

// Role: Replace the whole panel profile with sensible defaults + provided overrides.
export function setPanel(cfg = {}) {
  panelState.set({ ...defaults, ...cfg, isOpen: !!cfg.isOpen });
}
/**
 * Set the entire panel profile at once (full replacement).
 *
 * Useful when a page wants to fully define how the panel should look/behave.
 *
 * @param {Partial<PanelState>} [cfg]
 * @example
 * // In a page component:
 * $effect(() => {
 *   setPanel({
 *     title: 'Filters',
 *     side: 'left',
 *     backdrop: true,
 *     floating: true,
 *     content: { component: FiltersPanel, props: { onApply } },
 *     isOpen: false,
 *   });
 * });
 */

// Role: Partially update current panel state without resetting other fields.
export function patchPanel(patch = {}) {
  panelState.update((p) => ({ ...p, ...patch }));
}
/**
 * Partially patch the current panel state.
 *
 * Useful for small runtime tweaks (e.g., toggling open/closed, swapping content props)
 * without rebuilding the entire profile.
 *
 * @param {Partial<PanelState>} [patch]
 * @example
 * // Open panel without touching other fields:
 * patchPanel({ isOpen: true });
 *
 * // Update only content props:
 * patchPanel({ content: { component: FiltersPanel, props: { category: 'books' } } });
 */

// Role: Open the panel; optionally set a full profile before opening.
export function openPanel(cfg) {
  if (cfg) setPanel(cfg);
  else patchPanel({ isOpen: true });
}
/**
 * Open the panel. Optionally provide a full configuration to set before opening.
 *
 * @param {Partial<PanelState>=} cfg
 * @example
 * // Simple open (uses existing profile):
 * openPanel();
 *
 * // Open with a fresh profile:
 * openPanel({
 *   title: 'Layout',
 *   content: { component: LayoutSwitcher, props: { onChange } },
 *   side: 'left',
 *   backdrop: true,
 *   floating: true,
 *   isOpen: true
 * });
 */

// Role: Close the panel, preserving the rest of the profile.
export function closePanel() {
  patchPanel({ isOpen: false });
}
/**
 * Close the panel (keeps profile data intact).
 *
 * @example
 * // In App.svelte, close on backdrop:
 * <Panel onBackdropClick={() => closePanel()} ... />
 */

// Role: Reset panel state to defaults (including content).
export function resetPanel() {
  panelState.set({ ...defaults });
}
/**
 * Reset the entire panel state back to defaults.
 *
 * Useful when leaving a page or when you want to guarantee a clean slate.
 *
 * @example
 * resetPanel();
 */

// Role: Set a profile on mount and get an auto-cleanup disposer for unmount.
export function withPanel(cfg = {}) {
  setPanel({ ...cfg, isOpen: false });
  return () => resetPanel();
}
/**
 * Declaratively apply a panel profile for the lifetime of the current scope,
 * returning a disposer that resets the panel on cleanup.
 *
 * Typical usage is inside a Svelte 5 `$effect`, returning the disposer.
 *
 * @param {Partial<PanelState>} [cfg]
 * @returns {() => void} disposer that resets the panel to defaults
 * @example
 * // In a page component (Svelte 5 runes):
 * let { route } = $props();
 * $effect(() => {
 *   const dispose = withPanel({
 *     title: 'Handbook',
 *     side: 'left',
 *     backdrop: true,
 *     floating: true,
 *     content: { component: HandbookPanel, props: { onSelect } }
 *   });
 *   return dispose; // auto reset on unmount / dep change
 * });
 *
 * // To programmatically open/close:
 * // openPanel();
 * // closePanel();
 */
