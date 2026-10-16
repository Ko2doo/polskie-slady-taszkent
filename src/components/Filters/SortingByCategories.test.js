import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { Preferences } from '@capacitor/preferences';
import { getStorage } from '@/capacitor/utils/appStorage';
import { i18nStub } from '@/test/i18nStub';
import { reactiveProps } from '@/test/reactiveProps.svelte.js';
import SortingByCategories from '@/components/Filters/SortingByCategories.svelte';

const ITEMS = [
  { id: 'l01', category: 'religion' },
  { id: 'l02', category: 'memorial' },
  { id: 'l03', category: 'religion' },
  { id: 'l04' },
];

let target;
let component;
let onSelectedChange;

async function render(overrides = {}) {
  const props = reactiveProps({
    i18n: i18nStub,
    items: ITEMS,
    storageKey: 'test.category',
    onSelectedChange,
    ...overrides,
  });
  component = mount(SortingByCategories, { target, props });
  flushSync();
  await settle();
  return props;
}

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};
const labels = () =>
  [...target.querySelectorAll('.list-item-title, [class*="item-title"]')].map((el) => el.textContent.trim());
const radios = () => [...target.querySelectorAll('input[type="radio"]')];

function choose(index) {
  radios()[index].click();
  flushSync();
}

beforeEach(async () => {
  await Preferences.clear();
  onSelectedChange = vi.fn();
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('SortingByCategories', () => {
  it('offers "all" plus every category of the items, sorted, once each', async () => {
    await render();

    expect(radios()).toHaveLength(3);
    expect(target.textContent).toContain('ui:sidePanel:handbook:filters:category:all');
    const text = target.textContent;
    expect(text.indexOf('category:memorial')).toBeLessThan(text.indexOf('category:religion'));
  });

  it('"all" is selected at first and nothing is reported', async () => {
    await render();

    expect(radios()[0].checked).toBe(true);
    expect(onSelectedChange).not.toHaveBeenCalled();
  });

  it('picking a category reports it and remembers it', async () => {
    await render();

    choose(2);
    await settle();

    expect(onSelectedChange).toHaveBeenLastCalledWith('religion');
    expect(await getStorage('test.category')).toBe('religion');
  });

  it('restores the remembered category', async () => {
    await Preferences.set({ key: 'test.category', value: 'memorial' });

    await render();

    expect(onSelectedChange).toHaveBeenLastCalledWith('memorial');
    expect(radios()[1].checked).toBe(true);
  });

  // e.g. a category removed in a newer app version
  it('a remembered category that no item has falls back to "all"', async () => {
    await Preferences.set({ key: 'test.category', value: 'sport' });

    await render();

    expect(onSelectedChange).toHaveBeenLastCalledWith('all');
    expect(radios()[0].checked).toBe(true);
  });

  it('when the items lose the selected category, goes back to "all"', async () => {
    const props = await render();
    choose(2);

    props.items = ITEMS.filter((item) => item.category !== 'religion');
    flushSync();

    expect(onSelectedChange).toHaveBeenLastCalledWith('all');
  });

  // BUG: the saved category is restored in the background; a pick made before that finished is
  // overwritten — with "all" when nothing was saved (see BUGS.md). Remove `.fails` once fixed.
  it.fails('a category picked before the restore finished is kept', async () => {
    const props = reactiveProps({ i18n: i18nStub, items: ITEMS, storageKey: 'test.category', onSelectedChange });
    component = mount(SortingByCategories, { target, props });
    flushSync();

    choose(2);
    await settle();

    expect(radios()[2].checked).toBe(true);
    expect(onSelectedChange).toHaveBeenLastCalledWith('religion');
  });
});
