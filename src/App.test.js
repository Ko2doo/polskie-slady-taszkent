import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { initBackButtonHandler } from '@/capacitor/backButton';
import { bottomTabbarState, resetTabbar } from '@/lib/state/bottomTabbarNav.svelte.js';
import { openPanel, panelState, resetPanel } from '@/lib/state/panel.svelte.js';
import { resetNavbar } from '@/lib/state/navbar.svelte.js';
import { initCustomPointsPersistence } from '@/lib/state/customPointsState.svelte';
import { initFirstLaunch } from '@/store/appStartInitialize';
import { errorToast } from '@/store/ui/errorToast';
import { captured } from '@/test/ContextProbe.svelte';
import App from '@/App.svelte';

// The shell's own wiring is under test; every heavy child has its own tests and is a stand-in here
const { empty } = vi.hoisted(() => ({
  empty: async () => ({ default: (await import('@/test/EmptyComponent.svelte')).default }),
}));
vi.mock('@/AppSplash.svelte', empty);
vi.mock('@/components/BottomTabbarNav.svelte', empty);
vi.mock('@/components/ErrorHandlerToast.svelte', empty);
vi.mock('@/components/ExitToast.svelte', empty);
vi.mock('@/components/Article.svelte', empty);
vi.mock('@/views/OnboardingWizard/OnboardingWizard.svelte', empty);
// The router stand-in reads the scroll context the shell provides to every screen
vi.mock('@mateothegreat/svelte5-router', async () => ({
  Router: (await import('@/test/ContextProbe.svelte')).default,
}));
vi.mock('@/Routes', () => ({ routes: [] }));
vi.mock('@/capacitor/services/i18n', async () => ({
  i18nStores: { i18n: (await import('@/test/i18nStub')).i18nStub },
}));
vi.mock('@/capacitor/backButton', () => ({ initBackButtonHandler: vi.fn() }));
vi.mock('@/store/appStartInitialize', async () => ({
  initFirstLaunch: vi.fn(),
  markFirstLaunchCompleted: vi.fn(),
  APP_FIRST_LAUNCH_STORAGE_VAL: (await import('svelte/store')).writable(null),
}));
vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

// The storage notices are a reactive list, like in the real state
vi.mock('@/lib/state/customPointsState.svelte', async () => {
  const { reactiveProps } = await import('@/test/reactiveProps.svelte.js');
  const holder = reactiveProps({ notices: [] });
  return {
    initCustomPointsPersistence: vi.fn(),
    customPointsState: {
      holder,
      get notices() {
        return holder.notices;
      },
      takeNotices: () => holder.notices.splice(0, holder.notices.length),
    },
  };
});

import { customPointsState } from '@/lib/state/customPointsState.svelte';

let target;
let component;
let finishFirstLaunch;

const settle = async () => {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};
const isSplashShown = () => target.querySelector('.app-wrapper') === null;

beforeEach(() => {
  initFirstLaunch.mockReset().mockImplementation(() => new Promise((resolve) => (finishFirstLaunch = resolve)));
  initBackButtonHandler.mockClear();
  initCustomPointsPersistence.mockClear();
  Object.values(errorToast).forEach((fn) => fn.mockClear());
  customPointsState.holder.notices.length = 0;
  resetTabbar();
  resetPanel();
  resetNavbar();
  target = document.createElement('div');
  document.body.append(target);
  component = mount(App, { target, props: { appName: 'Polskie Ślady', version: '1.2.0', appLogo: '/logo.png' } });
  flushSync();
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('start', () => {
  // The first-launch flag decides whether the onboarding shows: nothing else starts before it
  it('shows the splash until the first-launch state is read, then starts the app', async () => {
    expect(isSplashShown()).toBe(true);
    expect(initBackButtonHandler).not.toHaveBeenCalled();

    finishFirstLaunch();
    await settle();

    expect(isSplashShown()).toBe(false);
    expect(initBackButtonHandler).toHaveBeenCalledTimes(1);
    expect(initCustomPointsPersistence).toHaveBeenCalledTimes(1);
  });

  // The splash holds the tab bar hidden (AppSplash.test.js); the shell itself never does, so
  // nothing is left holding it once the app is ready
  it('leaves the tabbar visible once ready', async () => {
    finishFirstLaunch();
    await settle();

    expect(bottomTabbarState.isVisible).toBe(true);
  });
});

describe('storage notices', () => {
  beforeEach(async () => {
    finishFirstLaunch();
    await settle();
  });

  it('a problem reading the saved points is a warning', () => {
    customPointsState.holder.notices.push('StoreCorrupted');
    flushSync();

    expect(errorToast.warn).toHaveBeenCalledWith('errors:customPointsStoreCorrupted');
    expect(customPointsState.notices).toHaveLength(0);
  });

  // The user's latest change may be lost: that is more than a warning
  it('a failed save is an error', () => {
    customPointsState.holder.notices.push('StoreSaveFailed');
    flushSync();

    expect(errorToast.error).toHaveBeenCalledWith('errors:customPointsStoreSaveFailed');
  });

  it('every notice is shown once', () => {
    customPointsState.holder.notices.push('StoreUnreadable', 'StoreUnsupported');
    flushSync();
    flushSync();

    expect(errorToast.warn).toHaveBeenCalledTimes(2);
  });
});

describe('shell', () => {
  beforeEach(async () => {
    finishFirstLaunch();
    await settle();
  });

  // Handbook.test.js covers how a screen uses it; here: the shell keeps it in sync
  it('shares the scroll position of the content with the screens', () => {
    const wrapper = target.querySelector('.app-wrapper');

    wrapper.scrollTop = 120;
    wrapper.dispatchEvent(new Event('scroll'));
    flushSync();

    expect(captured.value.y).toBe(120);
  });

  it('the side panel close button closes it', () => {
    openPanel({ title: 'Filters' });
    flushSync();

    document.body.querySelector('.panel a, [class*="panel"] a').click();
    flushSync();

    expect(panelState.isOpen).toBe(false);
  });
});
