import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { goto } from '@mateothegreat/svelte5-router';
import { bottomTabbarState, resetTabbar } from '@/lib/state/bottomTabbarNav.svelte.js';
import { resetNavbar } from '@/lib/state/navbar.svelte.js';
import { realI18n } from '@/test/realI18n';
import More from '@/views/More/More.svelte';

vi.mock('@mateothegreat/svelte5-router', () => ({ goto: vi.fn() }));

let target;
let component;

beforeEach(async () => {
  goto.mockClear();
  resetNavbar();
  resetTabbar();
  target = document.createElement('div');
  document.body.append(target);
  component = mount(More, {
    target,
    props: { i18n: await realI18n('en'), route: { result: { path: { original: '/more' } } } },
  });
  flushSync();
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('More', () => {
  it('lists settings, about and technical info; a tap opens the screen', () => {
    const items = [...target.querySelectorAll('a, button')].filter((item) => item.textContent.trim());
    expect(items).toHaveLength(3);

    items[2].click();

    expect(goto).toHaveBeenCalledWith('/technical-info');
  });

  it('shows the tabbar (it is a tab)', () => {
    expect(bottomTabbarState.isVisible).toBe(true);
  });

  // Real locales: the footer and the logo follow the language, the version is interpolated
  it('the version line, the credits and the logo are translated', async () => {
    unmount(component);
    component = mount(More, {
      target,
      props: { i18n: await realI18n('pl'), version: '1.2.0', route: { result: { path: { original: '/more' } } } },
    });
    flushSync();

    expect(target.textContent).toContain('Wersja aplikacji: 1.2.0');
    expect(target.textContent).toContain('Zrobione w');
    expect(target.querySelector('img').getAttribute('alt')).toBe('Logo projektu');
  });
});
