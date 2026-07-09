/**
 * Navbar states
 */

import { createUIProfile } from './createUIProfile.svelte';

const defaults = {
  title: '',
  leftSnippet: null,
  rightSnippet: null,
  subnavSnippet: null,
};

function createNavbarState() {
  const profile = createUIProfile(defaults);

  return {
    get title() {
      return profile.title;
    },

    get leftSnippet() {
      return profile.leftSnippet;
    },

    get rightSnippet() {
      return profile.rightSnippet;
    },

    get subnavSnippet() {
      return profile.subnavSnippet;
    },

    setNavbar: profile.set,
    patchNavbar: profile.patch,
    resetNavbar: profile.reset,
    withNavbar: profile.withProfile,
  };
}

export const navbarState = createNavbarState();

// Named exports kept for call-site compatibility
export const { setNavbar, patchNavbar, resetNavbar, withNavbar } = navbarState;
