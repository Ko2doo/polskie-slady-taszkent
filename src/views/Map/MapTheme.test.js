import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildBaseMapStyle } from '@/services/mapStyle';
import { errorToast } from '@/store/ui/errorToast';
import { PMTILES_KEY } from '@/views/Map/MapConstants';
import { buildMapStyle, createThemeController, getCurrentMapTheme } from '@/views/Map/MapTheme.svelte.js';

// The theme manager is driven by the test: `theme.switchTo(isDark)` is the user toggling dark mode
const theme = vi.hoisted(() => ({ isDark: false, listeners: new Set() }));

vi.mock('@/lib/theme/themeManager', () => ({
  getThemeManager: () => ({
    getState: () => ({ isDark: theme.isDark }),
    subscribe: (listener) => {
      theme.listeners.add(listener);
      listener({ isDark: theme.isDark });
      return () => theme.listeners.delete(listener);
    },
  }),
}));

vi.mock('@/services/mapStyle', () => ({ buildBaseMapStyle: vi.fn((options) => ({ builtFor: options })) }));
vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn() } }));

function switchTo(isDark) {
  theme.isDark = isDark;
  theme.listeners.forEach((listener) => listener({ isDark }));
}

// A map that records setStyle and lets the test fire "idle" (the new style finished loading)
function createMap() {
  const idle = new Set();
  return {
    idle,
    setStyle: vi.fn(),
    setMaxBounds: vi.fn(),
    on: vi.fn((event, handler) => event === 'idle' && idle.add(handler)),
    off: vi.fn((event, handler) => event === 'idle' && idle.delete(handler)),
    fireIdle: () => [...idle].forEach((handler) => handler()),
  };
}

let map;
let onStyleRestored;

function createController() {
  return createThemeController({ map, i18n: { language: 'pl', t: (k) => k }, onStyleRestored });
}

// Let the async style build finish
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  theme.isDark = false;
  theme.listeners.clear();
  buildBaseMapStyle.mockClear();
  errorToast.error.mockClear();

  map = createMap();
  onStyleRestored = vi.fn();
});

describe('init', () => {
  it('returns the current theme without touching the map', () => {
    theme.isDark = true;

    expect(createController().init()).toBe('dark');
    expect(map.setStyle).not.toHaveBeenCalled();
  });
});

// The first style is built before the controller exists; the app theme can change in between
// (the system switched to dark while the map loaded)
describe('init with the theme the style was built with', () => {
  it('applies a theme that changed meanwhile', async () => {
    theme.isDark = true;

    createController().init('light');
    await settle();

    expect(map.setStyle).toHaveBeenCalledWith(
      expect.objectContaining({ builtFor: expect.objectContaining({ theme: 'dark' }) }),
    );
  });

  it('leaves the map alone when the theme is still the same', async () => {
    theme.isDark = true;

    createController().init('dark');
    await settle();

    expect(map.setStyle).not.toHaveBeenCalled();
  });
});

describe('before the map exists', () => {
  it('getCurrentMapTheme reads the app theme', () => {
    theme.isDark = true;
    expect(getCurrentMapTheme()).toBe('dark');

    theme.isDark = false;
    expect(getCurrentMapTheme()).toBe('light');
  });

  it('buildMapStyle builds the style for a theme with the local tiles and the given language', async () => {
    await buildMapStyle('dark', 'pl');

    expect(buildBaseMapStyle).toHaveBeenCalledWith({
      origin: window.location.origin,
      pmtilesKey: PMTILES_KEY,
      theme: 'dark',
      lang: 'pl',
      fontstack: 'Roboto Regular',
    });
  });

  it('a theme switch builds the style in the app language', async () => {
    createController().init();

    switchTo(true);
    await Promise.resolve();

    expect(buildBaseMapStyle).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark', lang: 'pl' }));
  });
});

describe('a theme switch', () => {
  it('sets the new style', async () => {
    const controller = createController();
    controller.init();

    switchTo(true);
    await settle();

    expect(controller.currentTheme).toBe('dark');
    expect(map.setStyle).toHaveBeenCalledWith({ builtFor: expect.objectContaining({ theme: 'dark' }) });
  });

  // The new style has none of the app's own content: its owner is told to put it back
  it('once the style is loaded, tells the owner to restore the map content, with the new version', async () => {
    const controller = createController();
    controller.init();
    switchTo(true);
    await settle();

    expect(onStyleRestored).not.toHaveBeenCalled();
    map.fireIdle();

    expect(onStyleRestored).toHaveBeenCalledWith(controller.styleVersion);
    expect(controller.styleVersion).toBe(1);
  });

  it('restores once, not on every later idle', async () => {
    const controller = createController();
    controller.init();
    switchTo(true);
    await settle();

    map.fireIdle();
    map.fireIdle();

    expect(onStyleRestored).toHaveBeenCalledTimes(1);
  });

  it('switching to the same theme does nothing', async () => {
    createController().init();

    switchTo(false);
    await settle();

    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it('two quick switches: only the last style restores the map content', async () => {
    const controller = createController();
    controller.init();
    switchTo(true);
    await settle();
    switchTo(false);
    await settle();

    map.fireIdle();

    expect(onStyleRestored).toHaveBeenCalledTimes(1);
    expect(onStyleRestored).toHaveBeenCalledWith(2);
  });

  it('two quick switches leave no idle listener behind', async () => {
    const controller = createController();
    controller.init();
    switchTo(true);
    await settle();
    switchTo(false);
    await settle();

    map.fireIdle();

    expect(map.idle.size).toBe(0);
  });

  it('a failed style build tells the user', async () => {
    buildBaseMapStyle.mockImplementationOnce(() => {
      throw new Error('bad flavor');
    });
    createController().init();

    switchTo(true);
    await settle();

    expect(errorToast.error).toHaveBeenCalledWith('errors:mapThemeFailed', expect.anything());
  });

  it('without a map, a switch is ignored', async () => {
    map = null;
    const controller = createController();
    controller.init();

    switchTo(true);
    await settle();

    expect(buildBaseMapStyle).not.toHaveBeenCalled();
  });
});

describe('dispose', () => {
  it('stops following the theme', async () => {
    const controller = createController();
    controller.init();

    controller.dispose();
    switchTo(true);
    await settle();

    expect(map.setStyle).not.toHaveBeenCalled();
    expect(theme.listeners.size).toBe(0);
  });
});
