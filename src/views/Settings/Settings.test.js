import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { openAppSettings } from '@/capacitor/services/locationPermission';
import { bottomTabbarState, resetTabbar } from '@/lib/state/bottomTabbarNav.svelte.js';
import { navbarState, resetNavbar } from '@/lib/state/navbar.svelte.js';
import { i18nStub } from '@/test/i18nStub';
import Settings from '@/views/Settings/Settings.svelte';

vi.mock('@/capacitor/services/locationPermission', () => ({ openAppSettings: vi.fn(async () => true) }));
vi.mock('@/lib/theme/themeManager', () => ({
  getThemeManager: () => ({
    subscribe: (listener) => {
      listener({ followSystem: true, isDark: false });
      return () => {};
    },
    setFollowSystem: vi.fn(),
    setDark: vi.fn(),
  }),
}));

let target;
let component;

beforeEach(() => {
  openAppSettings.mockClear();
  resetNavbar();
  resetTabbar();
  target = document.createElement('div');
  document.body.append(target);
  component = mount(Settings, {
    target,
    props: { i18n: i18nStub, route: { result: { path: { original: '/settings' } } } },
  });
  flushSync();
});

afterEach(() => {
  if (component) unmount(component);
  component = null;
  target.remove();
});

describe('Settings', () => {
  it('sets its navbar title and a back button, hides the tabbar', () => {
    expect(navbarState.title).toBe('ui:navbar:settings:title');
    expect(navbarState.leftSnippet).not.toBeNull();
    expect(bottomTabbarState.isVisible).toBe(false);
  });

  it('holds the language and theme settings', () => {
    expect(target.querySelector('.popover-trigger')).not.toBeNull();
    expect(target.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0);
  });

  it('the permissions button opens the system settings of the app', () => {
    const button = [...target.querySelectorAll('button')].find(
      (item) => item.textContent.trim() === 'ui:buttons:openSettings',
    );

    button.click();

    expect(openAppSettings).toHaveBeenCalled();
  });

  it('gives the navbar back when it goes away', () => {
    unmount(component);
    component = null;

    expect(navbarState.leftSnippet).toBeNull();
  });

  // BUG-23: the tabbar config is never reset when the screen goes away. Remove `.fails` once fixed.
  it.fails('gives the tabbar back when it goes away', () => {
    unmount(component);
    component = null;

    expect(bottomTabbarState.isVisible).toBe(true);
  });
});
