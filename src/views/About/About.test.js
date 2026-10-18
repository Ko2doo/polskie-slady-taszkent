import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { routerBack } from '@/services/navigationHistoryHook';
import { bottomTabbarState, resetTabbar } from '@/lib/state/bottomTabbarNav.svelte.js';
import { navbarState, resetNavbar } from '@/lib/state/navbar.svelte.js';
import { LANGUAGES, realI18n } from '@/test/realI18n';
import RenderSnippet from '@/test/RenderSnippet.svelte';
import About from '@/views/About/About.svelte';

// Rendered straight from the translations (about:fullInfo, returnObjects): runs on the real locales
vi.mock('@/services/navigationHistoryHook', () => ({ routerBack: vi.fn() }));

let target;
let component;

async function render(language = 'en') {
  component = mount(About, {
    target,
    props: { i18n: await realI18n(language), route: { result: { path: { original: '/about' } } } },
  });
  flushSync();
}

beforeEach(() => {
  routerBack.mockClear();
  resetNavbar();
  resetTabbar();
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  if (component) unmount(component);
  component = null;
  target.remove();
});

describe.each(LANGUAGES)('About (%s)', (language) => {
  it('renders every entry of about:fullInfo with a title', async () => {
    await render(language);

    const titles = [...target.querySelectorAll('b')].map((title) => title.textContent.trim());
    expect(titles.length).toBeGreaterThan(0);
    expect(titles.every(Boolean)).toBe(true);
    expect(target.textContent).not.toContain('about:fullInfo');
  });
});

describe('About', () => {
  it('the navbar back link goes back, the tabbar is hidden', async () => {
    await render();
    const host = document.createElement('div');
    const back = mount(RenderSnippet, { target: host, props: { snippet: navbarState.leftSnippet } });
    flushSync();

    host.querySelector('a').click();

    // A screen inside More: back goes to More, even after a reload (empty in-memory history)
    expect(routerBack).toHaveBeenCalledWith('/more');
    expect(bottomTabbarState.isVisible).toBe(false);
    unmount(back);
  });

  it('the back link has an accessible name', async () => {
    await render();
    const host = document.createElement('div');
    const back = mount(RenderSnippet, { target: host, props: { snippet: navbarState.leftSnippet } });
    flushSync();

    // An icon-only link: without an aria-label a screen reader announces nothing
    expect(host.querySelector('a').getAttribute('aria-label')).toBe('Back');
    unmount(back);
  });
});
