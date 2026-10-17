import { describe, it, expect, beforeEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { bottomTabbarState, resetTabbar } from '@/lib/state/bottomTabbarNav.svelte.js';
import { i18nStub } from '@/test/i18nStub';
import AppSplash from '@/AppSplash.svelte';

const props = { i18n: i18nStub, appName: 'Polskie Ślady', version: '1.2.0', appLogo: '/l.png' };

beforeEach(() => resetTabbar());

describe('AppSplash', () => {
  // The tab bar's entrance: it slides in slowly once the splash is gone
  it('hides the tab bar while shown, gives it back with the entrance animation', () => {
    const target = document.createElement('div');
    const splash = mount(AppSplash, { target, props });
    flushSync();
    expect(bottomTabbarState.isVisible).toBe(false);

    unmount(splash);

    expect(bottomTabbarState).toMatchObject({ isVisible: true, duration: 400, delay: 350 });
  });

  it('the version line and the logo text are translated', () => {
    const target = document.createElement('div');
    const splash = mount(AppSplash, { target, props });
    flushSync();

    expect(target.textContent).toContain('ui:splash:version');
    expect(target.textContent).toContain('1.2.0');
    expect(target.querySelector('img').getAttribute('alt')).toBe('ui:splash:logoAlt');
    unmount(splash);
  });
});
