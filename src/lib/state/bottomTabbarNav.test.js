import { describe, it, expect, beforeEach } from 'vitest';
import {
  bottomTabbarState,
  patchTabbar,
  resetTabbar,
  setTabbar,
  withTabbar,
} from '@/lib/state/bottomTabbarNav.svelte.js';

// Module-level singleton: back to the defaults before every test
beforeEach(() => resetTabbar());

describe('bottomTabbarState', () => {
  it('is visible by default', () => {
    expect(bottomTabbarState.isVisible).toBe(true);
    expect(bottomTabbarState.duration).toBeGreaterThan(0);
    expect(bottomTabbarState.delay).toBeGreaterThanOrEqual(0);
  });

  it('a screen hides it and the cleanup shows it again', () => {
    const { duration, delay } = bottomTabbarState;
    const dispose = withTabbar({ isVisible: false });

    expect(bottomTabbarState.isVisible).toBe(false);
    expect(bottomTabbarState.duration).toBe(duration);

    dispose();

    expect(bottomTabbarState.isVisible).toBe(true);
    expect(bottomTabbarState.delay).toBe(delay);
  });

  it('setTabbar replaces, patchTabbar merges', () => {
    setTabbar({ isVisible: false, duration: 1 });
    patchTabbar({ delay: 2 });

    expect(bottomTabbarState.duration).toBe(1);
    expect(bottomTabbarState.delay).toBe(2);
    expect(bottomTabbarState.isVisible).toBe(false);
  });
});
