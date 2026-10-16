import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { Capacitor } from '@capacitor/core';

// The App plugin, the router and the history hook are recorders; the overlay stack and the
// exit toast are the real stores. The back button itself is the listener the module registers.
const deps = vi.hoisted(() => ({}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (...args) => deps.addListener(...args),
    minimizeApp: (...args) => deps.minimizeApp(...args),
  },
}));

vi.mock('@mateothegreat/svelte5-router', () => ({ goto: (...args) => deps.goto(...args) }));

vi.mock('@/services/navigationHistoryHook', async () => {
  const { writable: store } = await import('svelte/store');
  deps.history = store({ stack: ['/'], current: '/' });

  return { navigationHistory: deps.history, routerBack: (...args) => deps.routerBack(...args) };
});

let backButton;
let overlayController;
let exitToast;
let pressBack;

async function load({ native = true, platform = 'android' } = {}) {
  vi.resetModules();
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(native);
  vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform);

  backButton = await import('@/capacitor/backButton');
  ({ overlayController } = await import('@/store/ui/overlayController'));
  ({ exitToast } = await import('@/services/toastController'));

  backButton.initBackButtonHandler();
  pressBack = deps.addListener.mock.lastCall?.[1];
}

function at(current, stack = [current]) {
  deps.history.set({ stack, current });
}

beforeEach(() => {
  deps.addListener = vi.fn();
  deps.minimizeApp = vi.fn();
  deps.goto = vi.fn();
  deps.routerBack = vi.fn();
});

describe('initBackButtonHandler', () => {
  it('listens to the Android back button once', async () => {
    await load();
    backButton.initBackButtonHandler();

    expect(deps.addListener).toHaveBeenCalledTimes(1);
    expect(deps.addListener.mock.lastCall[0]).toBe('backButton');
  });

  it('does nothing on the web and on iOS', async () => {
    await load({ native: false });
    await load({ platform: 'ios' });

    expect(deps.addListener).not.toHaveBeenCalled();
  });
});

describe('a back press', () => {
  beforeEach(() => load());

  it('closes the top overlay first, and nothing else', () => {
    const close = vi.fn();
    at('/about', ['/', '/about']);
    overlayController.register(close);

    pressBack();

    expect(close).toHaveBeenCalledTimes(1);
    expect(deps.routerBack).not.toHaveBeenCalled();
  });

  it('goes back through the history', () => {
    at('/about', ['/', '/more', '/about']);

    pressBack();

    expect(deps.routerBack).toHaveBeenCalledWith('/');
  });

  it('without history, goes to the map first', () => {
    at('/settings');

    pressBack();

    expect(deps.goto).toHaveBeenCalledWith('/');
    expect(deps.minimizeApp).not.toHaveBeenCalled();
  });
});

describe('double back to exit on the map', () => {
  beforeEach(async () => {
    await load();
    at('/');
  });

  it('the first press shows the exit toast with the exit window as its countdown', () => {
    pressBack();

    expect(get(exitToast)).toMatchObject({ opened: true, durationMs: 3000 });
    expect(deps.minimizeApp).not.toHaveBeenCalled();
  });

  it('a second press within the window minimizes the app and hides the toast', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10000);
    pressBack();

    now.mockReturnValue(12999);
    pressBack();

    expect(deps.minimizeApp).toHaveBeenCalledTimes(1);
    expect(get(exitToast).opened).toBe(false);
  });

  it('a second press after the window shows the toast again', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10000);
    pressBack();
    const { version } = get(exitToast);

    now.mockReturnValue(13001);
    pressBack();

    expect(deps.minimizeApp).not.toHaveBeenCalled();
    expect(get(exitToast).version).toBe(version + 1);
  });

  it('closing an overlay in between starts the exit over', () => {
    vi.spyOn(Date, 'now').mockReturnValue(10000);
    pressBack();
    // An overlay that unregisters itself on close, the way useOverlay does
    const id = overlayController.register(() => overlayController.unregister(id));
    pressBack();

    pressBack();

    expect(deps.minimizeApp).not.toHaveBeenCalled();
    expect(get(exitToast).opened).toBe(true);
  });
});
