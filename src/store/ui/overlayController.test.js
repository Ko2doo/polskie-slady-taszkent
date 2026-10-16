import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { overlayController, overlayState } from '@/store/ui/overlayController';

const stack = () => get(overlayState).stack;

beforeEach(() => overlayState.set({ stack: [] }));

describe('overlayController', () => {
  it('registers overlays in order with unique ids', () => {
    const first = overlayController.register(() => {});
    const second = overlayController.register(() => {});

    expect(first).not.toBe(second);
    expect(stack().map((item) => item.id)).toEqual([first, second]);
  });

  it('unregisters by id, an unknown id is ignored', () => {
    const first = overlayController.register(() => {});
    const second = overlayController.register(() => {});

    overlayController.unregister(first);
    overlayController.unregister(Symbol('unknown'));

    expect(stack().map((item) => item.id)).toEqual([second]);
  });

  it('tryClose calls the close of the top overlay only', () => {
    const bottom = vi.fn();
    const top = vi.fn();
    overlayController.register(bottom);
    overlayController.register(top);

    expect(overlayController.tryClose()).toBe(true);
    expect(top).toHaveBeenCalledTimes(1);
    expect(bottom).not.toHaveBeenCalled();
  });

  // The overlay unregisters itself in its close (see useOverlay)
  it('tryClose does not remove the overlay by itself', () => {
    overlayController.register(() => {});

    overlayController.tryClose();

    expect(stack()).toHaveLength(1);
  });

  it('tryClose with no overlays lets the back button do its default', () => {
    expect(overlayController.tryClose()).toBe(false);
  });

  it('tryClose on an overlay without a close function reports false', () => {
    overlayController.register(null);

    expect(overlayController.tryClose()).toBe(false);
  });

  it('survives a state without a stack', () => {
    overlayState.set({});

    overlayController.register(() => {});
    expect(stack()).toHaveLength(1);

    overlayState.set({});
    expect(() => overlayController.unregister(Symbol('x'))).not.toThrow();
  });
});
