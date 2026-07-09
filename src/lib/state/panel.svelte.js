/**
 * Panel states
 */

import { createUIProfile } from './createUIProfile.svelte';

const defaults = {
  isOpen: false,
  side: 'left', // 'left' | 'right'
  backdrop: true,
  floating: true,
  title: '',
  contentSnippet: null, // () => any
};

function createPanelState() {
  const profile = createUIProfile(defaults);

  function setPanel(cfg = {}) {
    profile.set({ ...cfg, isOpen: !!cfg.isOpen });
  }

  function openPanel(cfg) {
    if (cfg) setPanel({ ...cfg, isOpen: true });
    else profile.patch({ isOpen: true });
  }

  function closePanel() {
    profile.patch({ isOpen: false });
  }

  function withPanel(cfg = {}) {
    setPanel({ ...cfg, isOpen: false });
    return () => profile.reset();
  }

  return {
    get isOpen() {
      return profile.isOpen;
    },

    get side() {
      return profile.side;
    },

    get backdrop() {
      return profile.backdrop;
    },

    get floating() {
      return profile.floating;
    },

    get title() {
      return profile.title;
    },

    get contentSnippet() {
      return profile.contentSnippet;
    },

    setPanel,
    patchPanel: profile.patch,
    openPanel,
    closePanel,
    resetPanel: profile.reset,
    withPanel,
  };
}

export const panelState = createPanelState();

// Named exports kept for call-site compatibility
export const { setPanel, patchPanel, openPanel, closePanel, resetPanel, withPanel } = panelState;
