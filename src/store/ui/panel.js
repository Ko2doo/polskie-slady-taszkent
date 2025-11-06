/**
 * Panel Store Utilities (Svelte 5, KonstaUI)
 *
 */

import { writable } from 'svelte/store';

const defaults = {
  isOpen: false,
  side: 'left', // 'left' | 'right'
  backdrop: true,
  floating: true,
  title: '',
  contentSnippet: null, // () => any
};

export const panelState = writable({ ...defaults });

// Role: Replace the whole panel profile with sensible defaults + provided overrides.
export function setPanel(cfg = {}) {
  panelState.set({ ...defaults, ...cfg, isOpen: !!cfg.isOpen });
}

// Role: Partially update current panel state without resetting other fields.
export function patchPanel(patch = {}) {
  panelState.update((p) => ({ ...p, ...patch }));
}

// Role: Open the panel; optionally set a full profile before opening.
export function openPanel(cfg) {
  if (cfg) setPanel({ ...cfg, isOpen: true });
  else patchPanel({ isOpen: true });
}

// Role: Close the panel, preserving the rest of the profile.
export function closePanel() {
  patchPanel({ isOpen: false });
}

// Role: Reset panel state to defaults (including content).
export function resetPanel() {
  panelState.set({ ...defaults });
}

// Role: Set a profile on mount and get an auto-cleanup disposer for unmount.
export function withPanel(cfg = {}) {
  setPanel({ ...cfg, isOpen: false });
  return () => resetPanel();
}
