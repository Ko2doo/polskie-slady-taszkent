import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { i18nStub } from '@/test/i18nStub';
import LayoutSwitcher from '@/components/Filters/LayoutSwitcher.svelte';

// The layout store is a recorder with the store contract (layoutView.test.js covers the real one)
const layout = vi.hoisted(() => ({ value: null, listeners: new Set() }));
vi.mock('@/store/ui/layoutView', () => ({
  layoutView: {
    subscribe(listener) {
      layout.listeners.add(listener);
      listener(layout.value);
      return () => layout.listeners.delete(listener);
    },
    set: vi.fn((mode) => {
      layout.value = { mode };
      layout.listeners.forEach((listener) => listener(layout.value));
    }),
  },
}));

import { layoutView } from '@/store/ui/layoutView';

let target;
let component;

const option = (id) => target.querySelector(`[data-switcher-id="${id}"]`);

beforeEach(() => {
  layout.value = { mode: 'layoutGrid' };
  layout.listeners.clear();
  layoutView.set.mockClear();
  target = document.createElement('div');
  document.body.append(target);
  component = mount(LayoutSwitcher, { target, props: { i18n: i18nStub } });
  flushSync();
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('LayoutSwitcher', () => {
  it('highlights the current layout', () => {
    expect(option('layoutGrid').className).toContain('font-bold');
    expect(option('layoutRows').className).not.toContain('font-bold');
  });

  it('switches the layout', () => {
    option('layoutRows').click();
    flushSync();

    expect(layoutView.set).toHaveBeenCalledWith('layoutRows');
    expect(option('layoutRows').className).toContain('font-bold');
  });

  it('the current layout is not set again', () => {
    option('layoutGrid').click();

    expect(layoutView.set).not.toHaveBeenCalled();
  });

  it('stops listening when it goes away', () => {
    unmount(component);
    component = mount(LayoutSwitcher, { target, props: { i18n: i18nStub } });
    flushSync();

    expect(layout.listeners.size).toBe(1);
  });
});
