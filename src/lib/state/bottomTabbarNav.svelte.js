import { untrack } from 'svelte';
import { createUIProfile } from './createUIProfile.svelte';

/**
 * The bottom tab bar's visibility, as a set of hide requests.
 *
 * The tab bar is visible unless something asks to hide it: a screen that has no tab bar
 * (Settings, About, Technical Info), the map's edit mode, the splash, the onboarding. Each of them
 * holds its own request and releases it when it goes away, and the tab bar shows again once no
 * request is left. Nothing depends on the order screens mount and unmount in — when Settings is
 * destroyed after More has already mounted, More still gets its tab bar back — and a screen that
 * shows the tab bar (Map, Handbook, More) doesn't have to do anything.
 *
 * @example
 * // A screen without the tab bar: the effect's cleanup releases the request on unmount
 * $effect(() => hideTabbar({ duration: 120, delay: 40 }));
 *
 * // Hidden only while a condition holds (the map's edit mode)
 * $effect(() => {
 *   if (isEditMode) return hideTabbar({ duration: 120, delay: 40 });
 * });
 */

// The animation the tab bar uses when it slides in or out (BottomTabbarNav's fly transition)
const DEFAULT_ANIMATION = {
  duration: 400, // ms
  delay: 350, // ms
};

function createTabbarState() {
  const animation = createUIProfile(DEFAULT_ANIMATION);
  let hideRequests = $state(0);

  /**
   * Ask for the tab bar to be hidden until the returned function is called.
   * @param {{ duration?: number, delay?: number }} [slide] - how the tab bar slides out now and
   *   back in when this request is released (defaults to DEFAULT_ANIMATION)
   * @returns {() => void} release — safe to call more than once
   */
  function hideTabbar(slide = {}) {
    let isReleased = false;
    animation.set(slide);
    // Called from screens' $effects: reading the count there would subscribe them to every other
    // screen's requests (and re-run, or loop, on each of them)
    untrack(() => (hideRequests += 1));

    return () => {
      if (isReleased) return;
      isReleased = true;
      animation.set(slide);
      // Never below zero: a request taken before resetTabbar() may still be released after it
      untrack(() => (hideRequests = Math.max(0, hideRequests - 1)));
    };
  }

  /**
   * Drop every hide request and go back to the default animation (tests start from it).
   */
  function resetTabbar() {
    hideRequests = 0;
    animation.reset();
  }

  return {
    get isVisible() {
      return hideRequests === 0;
    },
    get duration() {
      return animation.duration;
    },
    get delay() {
      return animation.delay;
    },
    hideTabbar,
    resetTabbar,
  };
}

export const bottomTabbarState = createTabbarState();
export const { hideTabbar, resetTabbar } = bottomTabbarState;
