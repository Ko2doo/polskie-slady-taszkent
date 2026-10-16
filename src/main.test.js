import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Capacitor } from '@capacitor/core';

// main.js boots the app when imported: each test prepares the plugins, then imports a fresh copy
const deps = vi.hoisted(() => ({ mounts: [] }));

vi.mock('@/App.svelte', async () => ({ default: (await import('@/test/EmptyComponent.svelte')).default }));
vi.mock('svelte', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    mount: vi.fn((component, options) => {
      deps.mounts.push(options);
      deps.order.push('mount');
      return {};
    }),
  };
});
vi.mock('@/lib/theme/themeManager', () => ({
  getThemeManager: () => ({ init: vi.fn(async () => deps.order.push('theme')) }),
}));
vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: { hide: vi.fn(async () => deps.order.push('splash')) },
}));
vi.mock('@capacitor/app', () => ({ App: { getInfo: vi.fn() } }));

import { App as CapApp } from '@capacitor/app';

async function boot() {
  vi.resetModules();
  await import('@/main.js');
  await vi.waitFor(() => expect(deps.order).toContain('splash'), { timeout: 500 });
}

beforeEach(() => {
  deps.mounts.length = 0;
  deps.order = [];
  CapApp.getInfo.mockReset().mockResolvedValue({ version: '1.2.3', name: 'Polskie Ślady (native)' });
  document.body.innerHTML = '<div id="app"></div>';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('main.js', () => {
  // The first paint must already be in the right theme
  it('applies the theme, mounts the app into #app, then hides the native splash', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

    await boot();

    expect(deps.order).toEqual(['theme', 'mount', 'splash']);
    expect(deps.mounts[0].target).toBe(document.getElementById('app'));
    expect(deps.mounts[0].props.appLogo).toBeTruthy();
  });

  it('on the web: name and version from the build', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

    await boot();

    expect(deps.mounts[0].props).toMatchObject({ version: __APP_VERSION__, appName: __APP_NAME__ });
    expect(CapApp.getInfo).not.toHaveBeenCalled();
  });

  it('on a device: name and version of the installed app', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

    await boot();

    expect(deps.mounts[0].props).toMatchObject({ version: '1.2.3', appName: 'Polskie Ślady (native)' });
  });
});
