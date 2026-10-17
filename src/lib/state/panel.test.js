import { describe, it, expect, beforeEach } from 'vitest';
import {
  closePanel,
  openPanel,
  panelState,
  patchPanel,
  resetPanel,
  setPanel,
  withPanel,
} from '@/lib/state/panel.svelte.js';
import { get } from 'svelte/store';
import { overlayController, overlayState } from '@/store/ui/overlayController';

const content = () => {};

// Module-level singleton: back to the defaults before every test
beforeEach(() => resetPanel());

describe('panelState', () => {
  it('starts closed, on the left, with a backdrop', () => {
    expect(panelState.isOpen).toBe(false);
    expect(panelState.side).toBe('left');
    expect(panelState.backdrop).toBe(true);
    expect(panelState.floating).toBe(true);
    expect(panelState.title).toBe('');
    expect(panelState.contentSnippet).toBeNull();
  });

  // A screen configures the panel, the user opens it later
  it('withPanel configures it closed, even if asked to open', () => {
    withPanel({ title: 'Filters', side: 'right', contentSnippet: content, isOpen: true });

    expect(panelState.isOpen).toBe(false);
    expect(panelState.title).toBe('Filters');
    expect(panelState.side).toBe('right');
    expect(panelState.contentSnippet).toBe(content);
  });

  it('the withPanel cleanup resets everything, an open panel included', () => {
    const dispose = withPanel({ title: 'Filters' });
    openPanel();

    dispose();

    expect(panelState.isOpen).toBe(false);
    expect(panelState.title).toBe('');
  });

  it('openPanel without a config keeps the configured content', () => {
    withPanel({ title: 'Filters', contentSnippet: content });

    openPanel();

    expect(panelState.isOpen).toBe(true);
    expect(panelState.title).toBe('Filters');
    expect(panelState.contentSnippet).toBe(content);
  });

  it('openPanel with a config replaces it and opens', () => {
    withPanel({ title: 'Filters', side: 'right' });

    openPanel({ title: 'Other' });

    expect(panelState.isOpen).toBe(true);
    expect(panelState.title).toBe('Other');
    expect(panelState.side).toBe('left');
  });

  it('closePanel keeps the configuration', () => {
    openPanel({ title: 'Filters' });

    closePanel();

    expect(panelState.isOpen).toBe(false);
    expect(panelState.title).toBe('Filters');
  });

  it('setPanel turns isOpen into a boolean', () => {
    setPanel({ isOpen: 1 });
    expect(panelState.isOpen).toBe(true);

    setPanel({});
    expect(panelState.isOpen).toBe(false);
  });

  it('patchPanel merges', () => {
    setPanel({ title: 'A', side: 'right' });
    patchPanel({ title: 'B' });

    expect(panelState.side).toBe('right');
    expect(panelState.title).toBe('B');
  });
});

describe('the Android back button', () => {
  const stack = () => get(overlayState).stack;

  it('closes the open panel and leaves the stack empty', () => {
    openPanel();
    expect(stack()).toHaveLength(1);

    expect(overlayController.tryClose()).toBe(true);

    expect(panelState.isOpen).toBe(false);
    expect(stack()).toHaveLength(0);
  });

  it('the panel registers once, however it is opened, and every way of closing unregisters', () => {
    openPanel();
    openPanel({ title: 'Filters' });
    patchPanel({ isOpen: true });
    expect(stack()).toHaveLength(1);

    closePanel();
    expect(stack()).toHaveLength(0);

    setPanel({ isOpen: true });
    patchPanel({ isOpen: false });
    expect(stack()).toHaveLength(0);
  });

  // e.g. leaving the map screen through the tab bar while the filters panel is open
  it("a screen's withPanel cleanup with the panel open unregisters it", () => {
    const dispose = withPanel({ title: 'Filters' });
    openPanel();

    dispose();

    expect(panelState.isOpen).toBe(false);
    expect(stack()).toHaveLength(0);
  });
});
