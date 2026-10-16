import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { openAppSettings, requestLocationPermission } from '@/capacitor/services/locationPermission';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { errorToast } from '@/store/ui/errorToast';
import { i18nStub } from '@/test/i18nStub';
import OnboardingWizard from '@/views/OnboardingWizard/OnboardingWizard.svelte';

// The permission flow is a recorder: each test plays one outcome by calling the callbacks the
// way the real requestLocationPermission does (locationPermission.test.js covers the real one)
vi.mock('@/capacitor/services/locationPermission', () => ({
  requestLocationPermission: vi.fn(),
  openAppSettings: vi.fn(async () => true),
}));
vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn() } }));
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
let appState;
let makeCompleted;

function render() {
  component = mount(OnboardingWizard, {
    target,
    props: { i18n: i18nStub, appLogo: '/logo.png', appState, makeCompleted },
  });
  flushSync();
}

const settle = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};
const text = () => document.body.textContent;
const button = (key) => [...document.body.querySelectorAll('button')].find((item) => item.textContent.trim() === key);

async function click(element) {
  element.click();
  flushSync();
  await settle();
}

async function toPermissionStep() {
  appState.set(true);
  render();
  await click(button('ui:buttons:continue'));
}

beforeEach(() => {
  requestLocationPermission.mockReset();
  openAppSettings.mockClear();
  errorToast.error.mockClear();
  appState = writable(null);
  makeCompleted = vi.fn(async () => {
    appState.set(false);
  });
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('visibility', () => {
  it('hidden until the first-launch state is known, shown on a first launch', () => {
    render();
    expect(text()).not.toContain('ui:dialog:onboarding:welcomeDialog');

    appState.set(true);
    flushSync();
    expect(text()).toContain('ui:dialog:onboarding:welcomeDialog');
  });

  it('closes when the first launch is marked completed elsewhere', () => {
    appState.set(true);
    render();

    appState.set(false);
    flushSync();

    expect(text()).not.toContain('ui:dialog:onboarding:welcomeDialog');
  });

  it('hidden once onboarding was completed', () => {
    appState.set(false);
    render();

    expect(text()).not.toContain('ui:dialog:onboarding:welcomeDialog');
  });
});

describe('steps', () => {
  it('step 1: welcome, language and appearance; "continue" goes to the permission step', async () => {
    await toPermissionStep();

    expect(text()).toContain('ui:dialog:onboarding:step2Title');
    expect(text()).toContain('ui:dialog:onboarding:step2Msg');
  });

  it('"back" returns to step 1', async () => {
    await toPermissionStep();

    await click(button('ui:buttons:back'));

    expect(text()).toContain('ui:dialog:onboarding:step1Title');
  });

  it('"skip" completes without asking for the permission', async () => {
    await toPermissionStep();

    await click(button('ui:buttons:skip'));

    expect(requestLocationPermission).not.toHaveBeenCalled();
    expect(makeCompleted).toHaveBeenCalledTimes(1);
    expect(text()).not.toContain('ui:dialog:onboarding:step2Title');
  });
});

describe('location permission', () => {
  it('granted: completes the onboarding', async () => {
    requestLocationPermission.mockImplementationOnce(async ({ onSuccess }) => {
      await onSuccess();
      return { success: true };
    });
    await toPermissionStep();

    await click(button('ui:buttons:allow'));

    expect(makeCompleted).toHaveBeenCalledTimes(1);
  });

  it('the buttons are disabled while the system asks', async () => {
    let answer;
    requestLocationPermission.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve)));
    await toPermissionStep();

    await click(button('ui:buttons:allow'));

    expect(button('ui:buttons:waiting').disabled).toBe(true);
    expect(button('ui:buttons:skip').disabled).toBe(true);
    answer({ success: false });
    await settle();
    expect(button('ui:buttons:allow').disabled).toBe(false);
  });

  // The real flow calls onDenied and then onError with the permission code
  it('denied: stays open and offers the settings, which also completes the onboarding', async () => {
    requestLocationPermission.mockImplementationOnce(async ({ onDenied, onError }) => {
      onDenied();
      onError({ code: ERROR_CODES.OS_PLUG_GLOC_0003, message: 'denied' });
      return { success: false };
    });
    await toPermissionStep();

    await click(button('ui:buttons:allow'));

    expect(makeCompleted).not.toHaveBeenCalled();
    const [message, meta] = errorToast.error.mock.calls[0];
    expect(message).toBe(`errors:${ERROR_CODES.OS_PLUG_GLOC_0003}`);
    expect(meta.action.type).toBe('openSettings');

    await meta.action.handler();
    expect(openAppSettings).toHaveBeenCalled();
    expect(makeCompleted).toHaveBeenCalledTimes(1);
  });

  // The web/dev build has no permission dialog: nothing to tell the user
  it('on the web: completes silently', async () => {
    requestLocationPermission.mockImplementationOnce(async ({ onError }) => {
      onError({ code: ERROR_CODES.WEB_PLATFORM_NOT_SUPPORTED, message: 'web' });
      return { success: false };
    });
    await toPermissionStep();

    await click(button('ui:buttons:allow'));

    expect(makeCompleted).toHaveBeenCalledTimes(1);
    expect(errorToast.error).not.toHaveBeenCalled();
  });

  it('another plugin error: a toast without the settings action', async () => {
    requestLocationPermission.mockImplementationOnce(async ({ onError }) => {
      onError({ code: ERROR_CODES.OS_PLUG_GLOC_0002, message: 'unavailable' });
      return { success: false };
    });
    await toPermissionStep();

    await click(button('ui:buttons:allow'));

    expect(errorToast.error).toHaveBeenCalledWith(
      `errors:${ERROR_CODES.OS_PLUG_GLOC_0002}`,
      expect.objectContaining({ action: undefined }),
    );
  });
});

describe('failures', () => {
  it('a failed save keeps the onboarding open and tells the user', async () => {
    makeCompleted.mockRejectedValueOnce(new Error('storage down'));
    await toPermissionStep();

    await click(button('ui:buttons:skip'));

    expect(errorToast.error).toHaveBeenCalledTimes(1);
    expect(text()).toContain('ui:dialog:onboarding:step2Title');
  });

  // BUG: the two fallback messages are hard-coded English (see BUGS.md). Remove `.fails` once fixed.
  it.fails('the failure messages are translated', async () => {
    makeCompleted.mockRejectedValueOnce(new Error('storage down'));
    requestLocationPermission.mockRejectedValueOnce(new Error('bridge down'));
    await toPermissionStep();

    await click(button('ui:buttons:skip'));
    await click(button('ui:buttons:allow'));

    for (const [message] of errorToast.error.mock.calls) {
      expect(message).toMatch(/^errors:/);
    }
  });
});
