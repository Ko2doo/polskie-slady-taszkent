import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { overlayController, overlayState } from '@/store/ui/overlayController';
import { useOverlay } from '@/services/useOverlay';

// The real overlay stack; the Android back button is overlayController.tryClose()
const stackSize = () => get(overlayState).stack.length;

beforeEach(() => overlayState.set({ stack: [] }));

describe('useOverlay', () => {
  it('open registers the overlay once, however often it is called', () => {
    const { open } = useOverlay(() => {});

    open();
    open();

    expect(stackSize()).toBe(1);
  });

  it('close calls onClose and unregisters', () => {
    const onClose = vi.fn();
    const { open, close } = useOverlay(onClose);
    open();

    close();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stackSize()).toBe(0);
  });

  it('the back button calls onClose and unregisters', () => {
    const onClose = vi.fn();
    const { open } = useOverlay(onClose);
    open();

    expect(overlayController.tryClose()).toBe(true);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stackSize()).toBe(0);
  });

  it('can be opened again after the back button closed it', () => {
    const { open } = useOverlay(() => {});
    open();
    overlayController.tryClose();

    open();

    expect(stackSize()).toBe(1);
  });

  it('closing twice is safe and leaves other overlays alone', () => {
    const other = useOverlay(() => {});
    const { open, close } = useOverlay(() => {});
    other.open();
    open();

    close();
    close();

    expect(stackSize()).toBe(1);
  });

  it('the back button closes the top overlay only', () => {
    const bottom = vi.fn();
    const top = vi.fn();
    useOverlay(bottom).open();
    useOverlay(top).open();

    overlayController.tryClose();

    expect(top).toHaveBeenCalledTimes(1);
    expect(bottom).not.toHaveBeenCalled();
    expect(stackSize()).toBe(1);
  });

  it('works without an onClose', () => {
    const { open, close } = useOverlay();
    open();

    expect(() => overlayController.tryClose()).not.toThrow();
    expect(() => close()).not.toThrow();
  });
});
