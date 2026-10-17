import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { overlayController, overlayState } from '@/store/ui/overlayController';
import { articlePopupState } from '@/lib/state/article.svelte.js';

// The real overlay stack; the Android back button is overlayController.tryClose()
const stackSize = () => get(overlayState).stack.length;

// Module-level singleton: closed and with an empty stack before every test
beforeEach(() => {
  articlePopupState.close();
  overlayState.set({ stack: [] });
});

describe('articlePopupState', () => {
  it('opens an article and registers on the back-button stack', () => {
    articlePopupState.open('l01');

    expect(articlePopupState.id).toBe('l01');
    expect(articlePopupState.isOpen).toBe(true);
    expect(stackSize()).toBe(1);
  });

  it('close hides it and unregisters', () => {
    articlePopupState.open('l01');

    articlePopupState.close();

    expect(articlePopupState.isOpen).toBe(false);
    expect(stackSize()).toBe(0);
  });

  it('the back button closes it', () => {
    articlePopupState.open('l01');

    overlayController.tryClose();

    expect(articlePopupState.isOpen).toBe(false);
    expect(stackSize()).toBe(0);
  });

  it('opening another article while open switches it without a second registration', () => {
    articlePopupState.open('l01');
    articlePopupState.open('l02');

    expect(articlePopupState.id).toBe('l02');
    expect(stackSize()).toBe(1);
  });

  // The popup content stays rendered during the close animation
  it('keeps the id after closing', () => {
    articlePopupState.open('l03');
    articlePopupState.close();

    expect(articlePopupState.id).toBe('l03');
  });
});
