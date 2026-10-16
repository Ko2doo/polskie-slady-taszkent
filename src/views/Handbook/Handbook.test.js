import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { Preferences } from '@capacitor/preferences';
import { articlesMeta } from '@/data/articles';
import { articlePopupState } from '@/lib/state/article.svelte';
import { navbarState, resetNavbar } from '@/lib/state/navbar.svelte.js';
import { panelState, resetPanel } from '@/lib/state/panel.svelte.js';
import { i18nStub } from '@/test/i18nStub';
import { reactiveProps } from '@/test/reactiveProps.svelte.js';
import RenderSnippet from '@/test/RenderSnippet.svelte';
import Handbook from '@/views/Handbook/Handbook.svelte';

// The layout store is a recorder (layoutView.test.js covers the real one)
const layout = vi.hoisted(() => ({ value: { mode: 'layoutGrid', classes: 'grid' }, listeners: new Set() }));
vi.mock('@/store/ui/layoutView', () => ({
  layoutView: {
    subscribe(listener) {
      layout.listeners.add(listener);
      listener(layout.value);
      return () => layout.listeners.delete(listener);
    },
    set(mode) {
      layout.value = { mode, classes: mode };
      layout.listeners.forEach((listener) => listener(layout.value));
    },
  },
}));

let target;
let component;
let scroll;
const hosts = [];

const settle = async () => {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

// The search bar (navbar) and the filters (side panel) are snippets App.svelte renders
function renderSnippet(snippet) {
  const host = document.createElement('div');
  document.body.append(host);
  const instance = mount(RenderSnippet, { target: host, props: { snippet } });
  flushSync();
  hosts.push(() => (unmount(instance), host.remove()));
  return host;
}

const cardTitles = () => [...target.querySelectorAll('h1')].map((title) => title.textContent.trim());

function search(host, text) {
  const input = host.querySelector('input');
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
}

beforeEach(async () => {
  await Preferences.clear();
  layout.value = { mode: 'layoutGrid', classes: 'grid' };
  layout.listeners.clear();
  resetNavbar();
  resetPanel();
  articlePopupState.close();
  scroll = reactiveProps({ y: 0 });
  target = document.createElement('div');
  document.body.append(target);
  component = mount(Handbook, {
    target,
    props: { i18n: i18nStub, route: { result: { path: { original: '/handbook' } } } },
    context: new Map([['appScroll', scroll]]),
  });
  flushSync();
  await settle();
});

afterEach(() => {
  hosts.splice(0).forEach((dispose) => dispose());
  if (component) unmount(component);
  component = null;
  target.remove();
  articlePopupState.close();
});

describe('Handbook', () => {
  it('lists every historical place', () => {
    expect(cardTitles()).toEqual(articlesMeta.map((meta) => `articles:${meta.id}:title`));
  });

  it('a card opens its article', () => {
    target.querySelector('.card, [class*="card"]').click();

    expect(articlePopupState.isOpen).toBe(true);
    expect(articlePopupState.id).toBe(articlesMeta[0].id);
  });

  it('the search in the navbar narrows the list', () => {
    const bar = renderSnippet(navbarState.subnavSnippet);
    const [, second] = articlesMeta;

    search(bar, `${second.id}:title`);

    expect(cardTitles()).toEqual([`articles:${second.id}:title`]);
  });

  it('nothing found: says so', () => {
    const bar = renderSnippet(navbarState.subnavSnippet);

    search(bar, 'zzzz');

    expect(target.textContent).toContain('errors:notFound');
    expect(cardTitles()).toEqual([]);
  });

  it('the category filter in the side panel narrows the list, combined with the search', async () => {
    const panel = renderSnippet(panelState.contentSnippet);
    await settle(); // the filter restores the saved category first (see BUG-24)
    const heroes = articlesMeta.filter((meta) => meta.category === 'heroes');

    const radios = [...panel.querySelectorAll('input[type="radio"]')];
    radios[1].click(); // [all, heroes, places]
    flushSync();
    await settle();

    expect(cardTitles()).toEqual(heroes.map((meta) => `articles:${meta.id}:title`));

    const bar = renderSnippet(navbarState.subnavSnippet);
    search(bar, `${articlesMeta.find((meta) => meta.category === 'places').id}:title`);
    expect(cardTitles()).toEqual([]);
  });

  it('the rows layout shows the descriptions', () => {
    expect(target.textContent).not.toContain(`articles:${articlesMeta[0].id}:description`);

    layout.listeners.forEach((listener) => listener({ mode: 'layoutRows', classes: 'rows' }));
    flushSync();

    expect(target.textContent).toContain(`articles:${articlesMeta[0].id}:description`);
  });

  // Scrolling down hides the search bar and puts a search button in the navbar instead
  it('scrolling down past 80 px hides the search bar; back at the top it returns', () => {
    scroll.y = 200;
    flushSync();
    expect(navbarState.subnavSnippet).toBeNull();
    expect(navbarState.rightSnippet).not.toBeNull();

    scroll.y = 0;
    flushSync();
    expect(navbarState.subnavSnippet).not.toBeNull();
  });

  it('the search button brings the bar back while scrolled down', () => {
    scroll.y = 200;
    flushSync();

    renderSnippet(navbarState.rightSnippet).querySelector('a').click();
    flushSync();

    expect(navbarState.subnavSnippet).not.toBeNull();
  });

  it('gives the navbar and the side panel back when it goes away', () => {
    unmount(component);
    component = null;

    expect(navbarState.leftSnippet).toBeNull();
    expect(panelState.contentSnippet).toBeNull();
  });
});
