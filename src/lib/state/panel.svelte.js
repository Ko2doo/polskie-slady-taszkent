/**
 * Panel states
 */

import { createUIProfile } from './createUIProfile.svelte';
import { overlayController } from '@/store/ui/overlayController';

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

  // While open, the panel is on the back-button overlay stack, so Android back closes it first.
  // Every change of isOpen goes through syncOverlay — a screen resetting the panel on unmount
  // (withPanel) must not leave a closed panel on the stack.
  let overlayId = null;

  function syncOverlay() {
    if (profile.isOpen && !overlayId) {
      overlayId = overlayController.register(closePanel);
    } else if (!profile.isOpen && overlayId) {
      overlayController.unregister(overlayId);
      overlayId = null;
    }
  }

  function setPanel(cfg = {}) {
    profile.set({ ...cfg, isOpen: !!cfg.isOpen });
    syncOverlay();
  }

  function patchPanel(cfg) {
    profile.patch(cfg);
    syncOverlay();
  }

  function openPanel(cfg) {
    if (cfg) setPanel({ ...cfg, isOpen: true });
    else patchPanel({ isOpen: true });
  }

  function closePanel() {
    patchPanel({ isOpen: false });
  }

  function resetPanel() {
    profile.reset();
    syncOverlay();
  }

  function withPanel(cfg = {}) {
    setPanel({ ...cfg, isOpen: false });
    return resetPanel;
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
    patchPanel,
    openPanel,
    closePanel,
    resetPanel,
    withPanel,
  };
}

export const panelState = createPanelState();

// Named exports kept for call-site compatibility
export const { setPanel, patchPanel, openPanel, closePanel, resetPanel, withPanel } = panelState;
