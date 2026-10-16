import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { i18nStub } from '@/test/i18nStub';
import DarkModeToggler from '@/components/DarkModeToggler.svelte';

// The theme manager is a recorder driven by the test (it needs matchMedia, which jsdom lacks)
const theme = vi.hoisted(() => ({ state: { followSystem: true, isDark: false }, listeners: new Set() }));
vi.mock('@/lib/theme/themeManager', () => ({
  getThemeManager: () => ({
    subscribe(listener) {
      theme.listeners.add(listener);
      listener(theme.state);
      return () => theme.listeners.delete(listener);
    },
    setFollowSystem: vi.fn((value) => theme.set({ followSystem: value })),
    setDark: vi.fn((value) => theme.set({ isDark: value })),
  }),
}));

let target;
let component;
let manager;

const toggles = () => [...target.querySelectorAll('input[type="checkbox"]')];

function change(input, checked) {
  input.checked = checked;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
}

beforeEach(async () => {
  theme.state = { followSystem: true, isDark: false };
  theme.listeners.clear();
  theme.set = (patch) => {
    theme.state = { ...theme.state, ...patch };
    theme.listeners.forEach((listener) => listener(theme.state));
  };
  manager = (await import('@/lib/theme/themeManager')).getThemeManager();
  target = document.createElement('div');
  document.body.append(target);
  component = mount(DarkModeToggler, { target, props: { i18n: i18nStub } });
  flushSync();
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('DarkModeToggler', () => {
  it('following the system: only that toggle, on', () => {
    expect(toggles()).toHaveLength(1);
    expect(toggles()[0].checked).toBe(true);
  });

  it('turning "follow system" off shows the manual dark toggle', () => {
    change(toggles()[0], false);

    expect(toggles()).toHaveLength(2);
    expect(toggles()[1].checked).toBe(false);
  });

  it('the dark toggle switches the theme', () => {
    change(toggles()[0], false);

    change(toggles()[1], true);

    expect(theme.state.isDark).toBe(true);
    expect(toggles()[1].checked).toBe(true);
  });

  it('follows changes made elsewhere (e.g. the onboarding)', () => {
    theme.set({ followSystem: false, isDark: true });
    flushSync();

    expect(toggles()[1].checked).toBe(true);
  });

  it('stops listening when it goes away', () => {
    unmount(component);
    component = mount(DarkModeToggler, { target, props: { i18n: i18nStub } });
    flushSync();

    expect(theme.listeners.size).toBe(1);
    expect(manager).toBeTruthy();
  });
});
