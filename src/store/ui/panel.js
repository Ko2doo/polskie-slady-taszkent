/**
 * Panel store
 */

import { writable } from 'svelte/store';

const defaults = {
  isOpen: false,
  side: 'left', // 'left' | 'right'
  backdrop: true,
  floating: true,
  title: '',
  content: null, // {component, props} | null
};

export const panelState = writable({ ...defaults });

// full set with defaults
export function setPanel(cfg = {}) {
  panelState.set({ ...defaults, ...cfg, isOpen: !!cfg.isOpen });
}

export function patchPanel(patch = {}) {
  panelState.update((p) => ({ ...p, ...patch }));
}

// Panel open
export function openPanel(cfg) {
  if (cfg) setPanel(cfg);
  else patchPanel({ isOpen: true });
}

// Panel close
export function closePanel() {
  patchPanel({ isOpen: false });
}

// defaults reset
export function resetPanel() {
  panelState.set({ ...defaults });
}

export function withPanel(cfg = {}) {
  setPanel({ ...cfg, isOpen: false });
  return () => resetPanel();
}
