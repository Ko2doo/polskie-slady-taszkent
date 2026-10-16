import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { overlayController, overlayState } from '@/store/ui/overlayController';
import { createToggleOverlay } from '@/lib/state/createToggleOverlay';

// The real overlay stack; the Android back button is overlayController.tryClose()
const stackSize = () => get(overlayState).stack.length;

beforeEach(() => overlayState.set({ stack: [] }));

describe('createToggleOverlay', () => {
  it('opening registers it on the back-button stack, closing removes it', () => {
    const viewer = createToggleOverlay();

    viewer.open();
    expect(viewer.value).toBe(true);
    expect(stackSize()).toBe(1);

    viewer.close();
    expect(viewer.value).toBe(false);
    expect(stackSize()).toBe(0);
  });

  it('the back button closes it', () => {
    const viewer = createToggleOverlay();
    viewer.open();

    expect(overlayController.tryClose()).toBe(true);

    expect(viewer.value).toBe(false);
    expect(stackSize()).toBe(0);
  });

  it('toggle and set go through open/close (and so through the stack)', () => {
    const viewer = createToggleOverlay();

    viewer.toggle();
    expect(stackSize()).toBe(1);

    viewer.toggle();
    expect(viewer.value).toBe(false);
    expect(stackSize()).toBe(0);

    viewer.set(true);
    viewer.set(true);
    expect(stackSize()).toBe(1);

    viewer.set(false);
    expect(stackSize()).toBe(0);
  });

  it('a nested overlay closes first', () => {
    const outer = createToggleOverlay();
    const inner = createToggleOverlay();
    outer.open();
    inner.open();

    overlayController.tryClose();

    expect(inner.value).toBe(false);
    expect(outer.value).toBe(true);
  });

  // Starting open is only the initial value: nothing is registered until open() is called
  it('an initial true value is not registered', () => {
    const viewer = createToggleOverlay(true);

    expect(viewer.value).toBe(true);
    expect(stackSize()).toBe(0);
  });
});
