import { describe, it, expect, beforeEach } from 'vitest';
import { flushSync } from 'svelte';
import { bottomTabbarState, hideTabbar, resetTabbar } from '@/lib/state/bottomTabbarNav.svelte.js';

// Module-level singleton: back to the defaults before every test
beforeEach(() => resetTabbar());

describe('bottomTabbarState', () => {
  it('is visible by default, with the default animation', () => {
    expect(bottomTabbarState.isVisible).toBe(true);
    expect(bottomTabbarState.duration).toBe(400);
    expect(bottomTabbarState.delay).toBe(350);
  });

  it('a hide request hides it, releasing it shows it again', () => {
    const release = hideTabbar();
    expect(bottomTabbarState.isVisible).toBe(false);

    release();
    expect(bottomTabbarState.isVisible).toBe(true);
  });

  it('uses the request’s animation to slide out and back in', () => {
    const release = hideTabbar({ duration: 120, delay: 40 });
    expect(bottomTabbarState).toMatchObject({ duration: 120, delay: 40 });

    hideTabbar({ duration: 1, delay: 2 })();
    release();

    expect(bottomTabbarState).toMatchObject({ duration: 120, delay: 40 });
  });

  // e.g. leaving Settings for More: Settings' cleanup may run before or after More mounts
  it('stays hidden while any request is held, whatever order they are released in', () => {
    const settings = hideTabbar();
    const editMode = hideTabbar();

    settings();
    expect(bottomTabbarState.isVisible).toBe(false);

    editMode();
    expect(bottomTabbarState.isVisible).toBe(true);
  });

  it('releasing the same request twice does not release another one', () => {
    const first = hideTabbar();
    hideTabbar();

    first();
    first();

    expect(bottomTabbarState.isVisible).toBe(false);
  });

  it('a request released after a reset leaves it visible, not broken', () => {
    const stale = hideTabbar();
    resetTabbar();

    stale();
    expect(bottomTabbarState.isVisible).toBe(true);

    const fresh = hideTabbar();
    expect(bottomTabbarState.isVisible).toBe(false);
    fresh();
  });

  // Screens call it from an $effect: the effect must not subscribe to other screens' requests
  it('an effect holding a request does not re-run when another request changes', () => {
    let runs = 0;
    const stop = $effect.root(() => {
      $effect(() => {
        runs += 1;
        return hideTabbar();
      });
    });
    flushSync();

    hideTabbar()();
    flushSync();

    expect(runs).toBe(1);
    stop();
    expect(bottomTabbarState.isVisible).toBe(true);
  });
});
