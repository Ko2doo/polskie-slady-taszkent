import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { technicalInfoMeta } from '@/data/about';
import { routerBack } from '@/services/navigationHistoryHook';
import { navbarState, resetNavbar } from '@/lib/state/navbar.svelte.js';
import { resetTabbar } from '@/lib/state/bottomTabbarNav.svelte.js';
import { LANGUAGES, realI18n } from '@/test/realI18n';
import RenderSnippet from '@/test/RenderSnippet.svelte';
import TechnicalInfo from '@/views/TechnicalInfo/TechnicalInfo.svelte';

// Rendered from data/about.js + the translations (about:technicalInfo:<id>): runs on the real locales
vi.mock('@/services/navigationHistoryHook', () => ({ routerBack: vi.fn() }));

let target;
let component;

async function render(language = 'en') {
  component = mount(TechnicalInfo, {
    target,
    props: { i18n: await realI18n(language), route: { result: { path: { original: '/technical-info' } } } },
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

describe.each(LANGUAGES)('TechnicalInfo (%s)', (language) => {
  it('every technicalInfoMeta entry has its translation, and its links are shown', async () => {
    await render(language);

    // A missing entry comes back as the key string: its title renders as an empty <b>
    // One title per entry, in order (a static block after the list has its own <b>)
    const titles = [...target.querySelectorAll('b')]
      .slice(0, technicalInfoMeta.length)
      .map((title) => title.textContent.trim());
    expect(titles.every(Boolean)).toBe(true);
    for (const info of technicalInfoMeta) {
      for (const link of info.links ?? []) {
        expect(target.querySelector(`a[href="${link.href}"]`)).not.toBeNull();
      }
    }
  });
});

describe('TechnicalInfo', () => {
  it('the navbar back link goes back', async () => {
    await render();
    const host = document.createElement('div');
    const back = mount(RenderSnippet, { target: host, props: { snippet: navbarState.leftSnippet } });
    flushSync();

    host.querySelector('a').click();

    // A screen inside More: back goes to More, even after a reload (empty in-memory history)
    expect(routerBack).toHaveBeenCalledWith('/more');
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
