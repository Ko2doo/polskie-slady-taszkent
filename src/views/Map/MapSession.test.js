import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { errorToast } from '@/store/ui/errorToast';

// The session's own job is the order of the steps and stopping/releasing on dispose; every step is
// a recorder here (each module has its own tests, Map.test.js covers the screen's use of it).
// `deps.gates` lets a test hold a step open to dispose in the middle of start().
const deps = vi.hoisted(() => ({ calls: [], gates: {} }));

const gate = (name, value) => (deps.gates[name] ? deps.gates[name].then(() => value) : Promise.resolve(value));

vi.mock('@/views/Map/MapLifecycle.svelte.js', () => ({
  initializePMTiles: vi.fn(() => (deps.calls.push('tiles'), gate('tiles', deps.protocol))),
  initializeMap: vi.fn(() => {
    deps.calls.push('map');
    const handlers = {};
    deps.map = {
      on: vi.fn((event, handler) => (handlers[event] ??= []).push(handler)),
      off: vi.fn(),
      fire: (event) => (handlers[event] ?? []).forEach((handler) => handler()),
    };
    return deps.map;
  }),
  setupMapHandlers: vi.fn(),
  cleanupMap: vi.fn(),
}));

vi.mock('@/views/Map/MapTheme.svelte.js', () => ({
  INITIAL_STYLE_VERSION: 0,
  getCurrentMapTheme: () => 'dark',
  buildMapStyle: vi.fn(() => (deps.calls.push('style'), gate('style', { style: true }))),
  createThemeController: vi.fn((options) => {
    deps.calls.push('theme');
    return (deps.theme = { options, init: vi.fn() });
  }),
}));

vi.mock('@/views/Map/MapBuilder.svelte.js', () => ({
  createMapPointsBuilder: vi.fn((options) => (deps.calls.push('builder'), (deps.builder = { options }))),
  createCustomPointsBuilder: vi.fn((options) => {
    deps.calls.push('customBuilder');
    return (deps.customBuilder = { options, addPoint: vi.fn(), updatePoint: vi.fn() });
  }),
}));

// Class instances, not plain objects: the session keeps them in $state, which would deep-copy a
// plain object into a proxy (identity checks and later changes from the test would not hold)
vi.mock('@/views/Map/MapNavigation.svelte.js', () => ({
  createNavigationController: vi.fn(() => {
    deps.calls.push('navigation');
    return (deps.navigation = new (class {
      currentRoute = null;
    })());
  }),
}));

vi.mock('@/views/Map/MapNavigationGPS.svelte.js', () => ({
  createGPSNavigationController: vi.fn(() => {
    deps.calls.push('gps');
    return (deps.gps = new (class {
      currentRoute = null;
      dispose = vi.fn();
    })());
  }),
}));

vi.mock('@/views/Map/MapLoadTracker.js', () => ({
  createMapLoadTracker: vi.fn(() => (deps.tracker = { markSourcesAdded: vi.fn() })),
}));

vi.mock('@/views/Map/MapPreview.js', () => ({
  createPreviewTracker: vi.fn(
    () => (deps.previews = { resolve: vi.fn(async () => 'blob:cover'), release: vi.fn(), releaseAll: vi.fn() }),
  ),
}));

vi.mock('@/lib/state/customPointsState.svelte.js', () => ({
  customPointsState: {
    get ready() {
      return gate('points');
    },
    points: [{ id: 'a', coords: { lng: 1, lat: 2 }, title: 'A', photos: ['1.jpg'] }],
  },
}));

vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn() } }));

import { cleanupMap, initializeMap, initializePMTiles, setupMapHandlers } from '@/views/Map/MapLifecycle.svelte.js';
import { buildMapStyle } from '@/views/Map/MapTheme.svelte.js';
import { createMapSession } from '@/views/Map/MapSession.svelte.js';

const i18n = { language: 'pl', t: (key) => key };
const container = {};
let onMapClick;
let targetCoords;

function createSession() {
  onMapClick = vi.fn();
  return createMapSession({
    i18n,
    isPopupEnabled: () => true,
    getTargetCoords: () => targetCoords,
    onMapClick,
    onProgress: vi.fn(),
    onReady: vi.fn(),
  });
}

// Holds a step open until the returned function is called
function holdStep(name) {
  let open;
  deps.gates[name] = new Promise((resolve) => (open = resolve));
  return open;
}

beforeEach(() => {
  deps.calls = [];
  deps.gates = {};
  deps.protocol = { tile: () => {} };
  targetCoords = null;
  [initializePMTiles, initializeMap, setupMapHandlers, cleanupMap, buildMapStyle, errorToast.error].forEach((fn) =>
    fn.mockClear(),
  );
});

describe('start', () => {
  it('builds everything in order and resolves true', async () => {
    const session = createSession();

    expect(await session.start(container)).toBe(true);

    expect(deps.calls).toEqual(['tiles', 'style', 'map', 'builder', 'customBuilder', 'navigation', 'gps', 'theme']);
    expect(initializeMap).toHaveBeenCalledWith({ container, style: { style: true } });
    expect(buildMapStyle).toHaveBeenCalledWith('dark', 'pl');
    expect(session.navigation).toBe(deps.navigation);
    expect(session.gpsNavigation).toBe(deps.gps);
  });

  it('creates the builders with the first style version', async () => {
    await createSession().start(container);

    expect(deps.builder.options.styleVersion).toBe(0);
    expect(deps.customBuilder.options.styleVersion).toBe(0);
  });

  it('loads the tiles and builds the style side by side', async () => {
    const openTiles = holdStep('tiles');
    const started = createSession().start(container);

    await vi.waitFor(() => expect(buildMapStyle).toHaveBeenCalled());
    expect(initializeMap).not.toHaveBeenCalled();

    openTiles();
    expect(await started).toBe(true);
  });

  it('a failed style still lets the tiles go on dispose', async () => {
    buildMapStyle.mockRejectedValueOnce(new Error('style'));
    const session = createSession();

    expect(await session.start(container)).toBe(false);
    expect(errorToast.error).toHaveBeenCalled();

    session.dispose();
    expect(cleanupMap).toHaveBeenCalledWith(expect.objectContaining({ protocol: deps.protocol }));
  });

  it('the theme controller redraws whichever route is active', async () => {
    const session = createSession();
    await session.start(container);
    const route = { gps: true };

    deps.gps.currentRoute = route;

    expect(deps.theme.options.getCurrentRoute()).toBe(route);
    // With the theme the style was built with, so a change during the load is applied
    expect(deps.theme.init).toHaveBeenCalledWith('dark');
  });

  it('on the map "load": overlays with the target read at that moment, then the click handler', async () => {
    await createSession().start(container);
    targetCoords = [69.2, 41.3];

    deps.map.fire('load');

    expect(setupMapHandlers).toHaveBeenCalledWith(expect.objectContaining({ map: deps.map, targetCoords }));
    expect(deps.map.on).toHaveBeenCalledWith('click', onMapClick);
    expect(deps.tracker.markSourcesAdded).toHaveBeenCalled();
  });

  it('a failed step tells the user and resolves false', async () => {
    initializePMTiles.mockRejectedValueOnce(new Error('404'));

    expect(await createSession().start(container)).toBe(false);

    expect(errorToast.error).toHaveBeenCalledWith('errors:mapInitFailed', {
      scope: 'Map',
      code: ERROR_CODES.MAP_INIT_FAILED,
    });
  });
});

describe('saved points', () => {
  it('go on the map at once, without waiting for their cover', async () => {
    let finishCover;
    const session = createSession();
    deps.previews.resolve.mockImplementationOnce(() => new Promise((resolve) => (finishCover = resolve)));

    expect(await session.start(container)).toBe(true);

    expect(deps.customBuilder.addPoint).toHaveBeenCalledWith({
      id: 'a',
      coords: { lng: 1, lat: 2 },
      title: 'A',
      preview: '',
    });
    expect(deps.customBuilder.updatePoint).not.toHaveBeenCalled();

    finishCover('blob:cover');
    await vi.waitFor(() =>
      expect(deps.customBuilder.updatePoint).toHaveBeenCalledWith({ id: 'a', title: 'A', preview: 'blob:cover' }),
    );
  });

  it('a cover that arrives after the map is gone is given back, not shown', async () => {
    let finishCover;
    const session = createSession();
    deps.previews.resolve.mockImplementationOnce(() => new Promise((resolve) => (finishCover = resolve)));
    await session.start(container);
    const customBuilder = deps.customBuilder;

    session.dispose();
    finishCover('blob:cover');

    await vi.waitFor(() => expect(deps.previews.release).toHaveBeenCalledWith('a'));
    expect(customBuilder.updatePoint).not.toHaveBeenCalled();
  });
});

describe('disposed while starting', () => {
  it('during the tiles: no map is created, the tiles are released once they are in, no error', async () => {
    const openTiles = holdStep('tiles');
    const session = createSession();
    const started = session.start(container);

    session.dispose();
    openTiles();

    expect(await started).toBe(false);
    expect(initializeMap).not.toHaveBeenCalled();
    expect(cleanupMap).toHaveBeenCalledWith(expect.objectContaining({ protocol: deps.protocol }));
    expect(errorToast.error).not.toHaveBeenCalled();
  });

  it('during the style build: no map is created, the tiles are released', async () => {
    const openStyle = holdStep('style');
    const session = createSession();
    const started = session.start(container);
    await vi.waitFor(() => expect(buildMapStyle).toHaveBeenCalled());

    session.dispose();
    openStyle();

    expect(await started).toBe(false);
    expect(initializeMap).not.toHaveBeenCalled();
    // The tiles existed already, so dispose() itself released them
    expect(cleanupMap).toHaveBeenCalledWith(expect.objectContaining({ protocol: deps.protocol, map: null }));
  });

  it('during the saved points: the map is released, nothing more is built on it', async () => {
    const openPoints = holdStep('points');
    const session = createSession();
    const started = session.start(container);
    await vi.waitFor(() => expect(initializeMap).toHaveBeenCalled());

    session.dispose();
    openPoints();

    expect(await started).toBe(false);
    expect(cleanupMap).toHaveBeenCalledWith(expect.objectContaining({ map: deps.map, builder: deps.builder }));
    expect(deps.calls).not.toContain('navigation');
    expect(deps.calls).not.toContain('theme');
    expect(deps.map.on).not.toHaveBeenCalledWith('load', expect.any(Function));
  });
});

describe('disposed after a failed start', () => {
  // The style failed first, the screen was left, and only then the tiles finished loading
  it('tiles that finish later are released', async () => {
    const openTiles = holdStep('tiles');
    buildMapStyle.mockRejectedValueOnce(new Error('style'));
    const session = createSession();

    expect(await session.start(container)).toBe(false);
    session.dispose();
    openTiles();

    await vi.waitFor(() =>
      expect(cleanupMap).toHaveBeenCalledWith(expect.objectContaining({ protocol: deps.protocol })),
    );
  });
});

describe('dispose', () => {
  it('detaches the click handler and releases the map, the controllers, GPS and the previews', async () => {
    const session = createSession();
    await session.start(container);

    session.dispose();

    expect(deps.map.off).toHaveBeenCalledWith('click', onMapClick);
    expect(cleanupMap).toHaveBeenCalledWith({
      map: deps.map,
      protocol: deps.protocol,
      builder: deps.builder,
      customPointsBuilder: deps.customBuilder,
      navigation: deps.navigation,
      theme: deps.theme,
    });
    expect(deps.gps.dispose).toHaveBeenCalled();
    expect(deps.previews.releaseAll).toHaveBeenCalled();
    expect(session.navigation).toBeNull();
  });

  it('a second dispose releases nothing twice', async () => {
    const session = createSession();
    await session.start(container);

    session.dispose();
    session.dispose();

    expect(deps.gps.dispose).toHaveBeenCalledTimes(1);
    expect(cleanupMap).toHaveBeenLastCalledWith(expect.objectContaining({ map: null, builder: null, theme: null }));
  });
});
