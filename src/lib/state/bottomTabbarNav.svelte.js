/**
 * Panel states
 */

import { createUIProfile } from './createUIProfile.svelte';

const defaults = {
  isVisible: true,
  duration: 400, // by default
  delay: 350, // by defalut
};

function createTabbarState() {
  const profile = createUIProfile(defaults);

  return {
    get isVisible() {
      return profile.isVisible;
    },

    get duration() {
      return profile.duration;
    },

    get delay() {
      return profile.delay;
    },

    setTabbar: profile.set,
    patchTabbar: profile.patch,
    resetTabbar: profile.reset,
    withTabbar: profile.withProfile,
  };
}

export const bottomTabbarState = createTabbarState();

// Named exports kept for call-site compatibility
export const { setTabbar, patchTabbar, resetTabbar, withTabbar } = bottomTabbarState;
