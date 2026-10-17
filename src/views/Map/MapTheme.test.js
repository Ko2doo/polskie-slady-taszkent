import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildBaseMapStyle } from '@/services/mapStyle';
import { errorToast } from '@/store/ui/errorToast';
import { MAP_BOUNDS, PMTILES_KEY } from '@/views/Map/MapConstants';
import { createThemeController } from '@/views/Map/MapTheme.svelte.js';

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
let builder;
let customPointsBuilder;
let navigation;

function createController() {
  return createThemeController({
    map,
    builder,
    customPointsBuilder,
    navigation,
    i18n: { language: 'pl', t: (k) => k },
  });
}

// Let the async style build finish
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  theme.isDark = false;
  theme.listeners.clear();
  buildBaseMapStyle.mockClear();
  errorToast.error.mockClear();

  map = createMap();
  builder = {
    setStyleVersion: vi.fn(),
    addCityBoundaryLayer: vi.fn(),
    addMarkers: vi.fn(),
    addNavigationRoute: vi.fn(),
  };
  customPointsBuilder = { setStyleVersion: vi.fn(), init: vi.fn() };
  navigation = { currentRoute: null, restoreMarkers: vi.fn() };
});

describe('init', () => {
  it('returns the current theme without touching the map', () => {
    theme.isDark = true;

    expect(createController().init()).toBe('dark');
    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it('builds the style for a theme with the local tiles and the app language', async () => {
    await createController().buildStyleForTheme('dark');

    expect(buildBaseMapStyle).toHaveBeenCalledWith({
      origin: window.location.origin,
      pmtilesKey: PMTILES_KEY,
      theme: 'dark',
      lang: 'pl',
      fontstack: 'Roboto Regular',
    });
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

  // The new style has none of the app's own sources and layers: everything is put back
  it('once the style is loaded, restores the bounds, markers, custom points, route and nav markers', async () => {
    navigation.currentRoute = { type: 'Feature' };
    const controller = createController();
    controller.init();
    switchTo(true);
    await settle();

    map.fireIdle();

    expect(builder.setStyleVersion).toHaveBeenCalledWith(controller.styleVersion);
    expect(customPointsBuilder.setStyleVersion).toHaveBeenCalledWith(controller.styleVersion);
    expect(map.setMaxBounds).toHaveBeenCalledWith(MAP_BOUNDS);
    expect(builder.addCityBoundaryLayer).toHaveBeenCalled();
    expect(builder.addMarkers).toHaveBeenCalled();
    expect(customPointsBuilder.init).toHaveBeenCalled();
    expect(builder.addNavigationRoute).toHaveBeenCalledWith(navigation.currentRoute);
    expect(navigation.restoreMarkers).toHaveBeenCalled();
  });

  it('restores the route given by getCurrentRoute instead of the manual one', async () => {
    const gpsRoute = { type: 'Feature', gps: true };
    navigation.currentRoute = null;
    const controller = createThemeController({
      map,
      builder,
      customPointsBuilder,
      navigation,
      getCurrentRoute: () => gpsRoute,
      i18n: { language: 'pl', t: (k) => k },
    });
    controller.init();
    switchTo(true);
    await settle();

    map.fireIdle();

    expect(builder.addNavigationRoute).toHaveBeenCalledWith(gpsRoute);
  });

  it('restores once, not on every later idle', async () => {
    const controller = createController();
    controller.init();
    switchTo(true);
    await settle();

    map.fireIdle();
    map.fireIdle();

    expect(builder.addMarkers).toHaveBeenCalledTimes(1);
  });

  it('switching to the same theme does nothing', async () => {
    createController().init();

    switchTo(false);
    await settle();

    expect(map.setStyle).not.toHaveBeenCalled();
  });

  it('two quick switches: only the last style restores the overlays', async () => {
    const controller = createController();
    controller.init();
    switchTo(true);
    await settle();
    switchTo(false);
    await settle();

    map.fireIdle();

    expect(builder.addMarkers).toHaveBeenCalledTimes(1);
    expect(builder.setStyleVersion).toHaveBeenCalledWith(2);
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
