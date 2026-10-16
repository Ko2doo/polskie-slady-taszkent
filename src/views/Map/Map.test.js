import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { Preferences } from '@capacitor/preferences';
import { navbarState } from '@/lib/state/navbar.svelte.js';
import { panelState, resetPanel } from '@/lib/state/panel.svelte.js';
import { resetNavbar } from '@/lib/state/navbar.svelte.js';
import { errorToast } from '@/store/ui/errorToast';
import { i18nStub } from '@/test/i18nStub';
import RenderSnippet from '@/test/RenderSnippet.svelte';
import Map from '@/views/Map/Map.svelte';

// Every map module is covered on its own; here they are recorders, and the test checks how the
// screen wires them together. `deps` holds what each factory created, for the assertions.
const deps = vi.hoisted(() => ({ themes: [] }));

vi.mock('@/views/Map/MapLifecycle.svelte.js', () => ({
  initializePMTiles: vi.fn(() => deps.pmtiles()),
  initializeMap: vi.fn(({ container }) => {
    const handlers = {};
    deps.map = {
      container,
      on: vi.fn((event, handler) => (handlers[event] ??= []).push(handler)),
      off: vi.fn((event, handler) => (handlers[event] = (handlers[event] ?? []).filter((item) => item !== handler))),
      fire: (event, payload) => (handlers[event] ?? []).forEach((handler) => handler(payload)),
    };
    return deps.map;
  }),
  setupMapHandlers: vi.fn(),
  cleanupMap: vi.fn(),
  resolveTargetCoords: () => null,
}));

vi.mock('@/views/Map/MapBuilder.svelte.js', () => ({
  createMapPointsBuilder: vi.fn((options) => {
    deps.builderOptions = options;
    deps.builder = {
      setMarkersVisible: vi.fn(),
      isMarkerNear: vi.fn(() => false),
      addNavigationRoute: vi.fn(),
      clearNavigationRoute: vi.fn(),
      dispose: vi.fn(),
    };
    return deps.builder;
  }),
  createCustomPointsBuilder: vi.fn(() => {
    const points = new globalThis.Map();
    deps.customBuilder = {
      points,
      addPoint: vi.fn((point) => (points.has(point.id) ? null : (points.set(point.id, { ...point }), { ...point }))),
      updatePoint: vi.fn((point) => (points.has(point.id) ? { ...points.get(point.id), ...point } : null)),
      removePoint: vi.fn((id) => points.delete(id)),
      getPointIdAt: vi.fn(() => null),
      setVisible: vi.fn(),
      init: vi.fn(),
      dispose: vi.fn(),
    };
    return deps.customBuilder;
  }),
}));

vi.mock('@/views/Map/MapTheme.svelte.js', () => ({
  createThemeController: vi.fn((options) => {
    const theme = {
      options,
      init: vi.fn(() => 'light'),
      buildStyleForTheme: vi.fn(async () => ({})),
      dispose: vi.fn(),
      styleVersion: 0,
    };
    deps.themes.push(theme);
    return theme;
  }),
}));

vi.mock('@/views/Map/MapNavigation.svelte.js', () => ({
  // A class instance, not a plain object: Svelte's $state would deep-copy a plain object into a
  // proxy, and the test could no longer flip the mode flags the screen reads
  createNavigationController: vi.fn(() => {
    deps.navigation = new (class {
      navigationMode = false;
      navigationReady = false;
      handleMapClick = vi.fn();
      dispose = vi.fn();
      restoreMarkers = vi.fn();
    })();
    return deps.navigation;
  }),
}));

vi.mock('@/views/Map/MapNavigationGPS.svelte.js', () => ({
  createGPSNavigationController: vi.fn(() => {
    deps.gps = new (class {
      gpsMode = false;
      gpsReady = false;
      handleMapClick = vi.fn();
      dispose = vi.fn();
    })();
    return deps.gps;
  }),
}));

vi.mock('@/views/Map/MapLoadTracker.js', () => ({
  createMapLoadTracker: vi.fn(() => (deps.tracker = { markSourcesAdded: vi.fn() })),
}));

vi.mock('@/views/Map/MapPreview.js', () => ({
  resolvePreview: vi.fn(async (point) => (point.photos?.length ? 'blob:cover' : '')),
}));

// The saved points (customPointsState.test.js covers the real state)
vi.mock('@/lib/state/customPointsState.svelte.js', () => {
  const points = [];
  return {
    customPointsState: {
      ready: Promise.resolve(),
      points,
      getById: (id) => points.find((point) => point.id === id) ?? null,
      add: vi.fn((data) => {
        const point = { ...data, photos: data.photos ?? [] };
        points.push(point);
        return point;
      }),
      update: vi.fn((id, data) =>
        Object.assign(
          points.find((point) => point.id === id),
          data,
        ),
      ),
      remove: vi.fn((id) =>
        points.splice(
          points.findIndex((point) => point.id === id),
          1,
        ),
      ),
    },
  };
});

vi.mock('@/lib/state/customPointsDialogState.svelte.js', () => ({
  customPointsDialogState: () => ({
    hasSeen: vi.fn(async () => true),
    open: vi.fn(),
    close: vi.fn(),
    markCompleted: vi.fn(),
    get triggerValue() {
      return false;
    },
  }),
}));

vi.mock('@/services/customPointsPhotos', () => ({
  savePhoto: vi.fn(),
  deletePhotoFiles: vi.fn(async () => {}),
  deletePointPhotos: vi.fn(async () => {}),
  pruneUnreferenced: vi.fn(async () => 0),
  getPhotoUrl: vi.fn(async () => null),
  releasePhotoUrl: vi.fn(),
}));

vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { cleanupMap, initializeMap, initializePMTiles, setupMapHandlers } from '@/views/Map/MapLifecycle.svelte.js';
import { createThemeController } from '@/views/Map/MapTheme.svelte.js';
import { customPointsState } from '@/lib/state/customPointsState.svelte.js';

let target;
let component;
let chrome;

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  flushSync();
};

async function render() {
  component = mount(Map, { target, props: { i18n: i18nStub, route: { result: { path: { original: '/' } } } } });
  flushSync();
  await settle();
}

// The navbar's right slot (edit-mode / navigation buttons), rendered the way App.svelte does
function renderNavbarRight() {
  chrome?.unmount?.();
  const host = document.createElement('div');
  document.body.append(host);
  const instance = mount(RenderSnippet, { target: host, props: { snippet: navbarState.rightSnippet } });
  flushSync();
  chrome = { host, unmount: () => (unmount(instance), host.remove()) };
  return host;
}

async function enterEditMode() {
  const links = renderNavbarRight().querySelectorAll('a');
  links[0].click(); // [edit mode, navigation sheet]
  flushSync();
  await settle();
}

const tap = (lng = 69.24, lat = 41.3) => ({ point: { x: 10, y: 20 }, lngLat: { lng, lat } });
const button = (key) => [...document.body.querySelectorAll('button')].find((item) => item.textContent.trim() === key);

beforeEach(async () => {
  await Preferences.clear();
  deps.themes.length = 0;
  deps.pmtiles = async () => ({ tile: () => {} });
  customPointsState.points.length = 0;
  [initializePMTiles, initializeMap, setupMapHandlers, cleanupMap, createThemeController].forEach((fn) =>
    fn.mockClear(),
  );
  Object.values(errorToast).forEach((fn) => fn.mockClear());
  resetNavbar();
  resetPanel();
  target = document.createElement('div');
  document.body.append(target);
});

afterEach(() => {
  chrome?.unmount();
  chrome = null;
  if (component) unmount(component);
  component = null;
  target.remove();
});

describe('start', () => {
  it('loads the tiles, creates the map in its container, then the builders and controllers', async () => {
    await render();

    expect(initializePMTiles).toHaveBeenCalled();
    expect(initializeMap.mock.lastCall[0].container).toBeInstanceOf(HTMLElement);
    expect(deps.builderOptions.data.length).toBeGreaterThan(0);
    expect(deps.navigation).toBeTruthy();
    expect(deps.gps).toBeTruthy();
  });

  it('on the map "load": overlays, the click handler, and the loader is told the sources are in', async () => {
    await render();

    deps.map.fire('load');

    expect(setupMapHandlers).toHaveBeenCalledWith(expect.objectContaining({ map: deps.map, builder: deps.builder }));
    expect(deps.map.on).toHaveBeenCalledWith('click', expect.any(Function));
    expect(deps.tracker.markSourcesAdded).toHaveBeenCalled();
  });

  it('puts the saved custom points on the map, with their cover as preview', async () => {
    customPointsState.points.push(
      { id: 'a', coords: { lng: 1, lat: 2 }, title: 'A', photos: ['photos/a/1.jpg'] },
      { id: 'b', coords: { lng: 3, lat: 4 }, title: 'B', photos: [] },
    );

    await render();

    expect(deps.customBuilder.addPoint).toHaveBeenCalledWith({
      id: 'a',
      coords: { lng: 1, lat: 2 },
      title: 'A',
      preview: 'blob:cover',
    });
    expect(deps.customBuilder.addPoint).toHaveBeenCalledWith({
      id: 'b',
      coords: { lng: 3, lat: 4 },
      title: 'B',
      preview: '',
    });
  });

  it('a failed start tells the user', async () => {
    deps.pmtiles = async () => {
      throw new Error('404');
    };

    await render();

    expect(errorToast.error).toHaveBeenCalledWith('errors:mapInitFailed', expect.anything());
  });

  // BUG: leaving the screen while it is still loading: onDestroy runs before the map exists, then
  // the rest of onMount creates a map (a WebGL context) nobody removes (see BUGS.md).
  // Remove `.fails` once fixed.
  it.fails('leaving while the tiles load does not create a map afterwards', async () => {
    let finishTiles;
    deps.pmtiles = () => new Promise((resolve) => (finishTiles = () => resolve({ tile: () => {} })));
    component = mount(Map, { target, props: { i18n: i18nStub, route: { result: { path: { original: '/' } } } } });
    flushSync();

    unmount(component);
    component = null;
    finishTiles();
    await settle();

    expect(initializeMap).not.toHaveBeenCalled();
  });

  // BUG-21: a first, map-less theme controller is created and initialized, then replaced without
  // dispose() — its theme subscription stays for good. Remove `.fails` once fixed.
  it.fails('no theme controller is left subscribed', async () => {
    await render();

    const replaced = deps.themes.slice(0, -1);
    expect(replaced.every((theme) => theme.dispose.mock.calls.length > 0)).toBe(true);
  });
});

describe('map clicks', () => {
  async function ready() {
    await render();
    deps.map.fire('load');
  }

  it('GPS mode takes the click when ready', async () => {
    await ready();
    deps.gps.gpsMode = true;
    deps.gps.gpsReady = true;

    deps.map.fire('click', tap());

    expect(deps.gps.handleMapClick).toHaveBeenCalled();
    expect(deps.navigation.handleMapClick).not.toHaveBeenCalled();
  });

  // GPS mode is switched on but still starting (permission, first fix): the click is not its yet
  it('GPS mode that is not ready yet does not take the click', async () => {
    await ready();
    deps.gps.gpsMode = true;

    deps.map.fire('click', tap());

    expect(deps.gps.handleMapClick).not.toHaveBeenCalled();
  });

  it('manual navigation takes the click', async () => {
    await ready();
    deps.navigation.navigationMode = true;

    deps.map.fire('click', tap());

    expect(deps.navigation.handleMapClick).toHaveBeenCalled();
  });

  it('with no mode active a click does nothing', async () => {
    await ready();

    deps.map.fire('click', tap());

    expect(deps.navigation.handleMapClick).not.toHaveBeenCalled();
    expect(deps.gps.handleMapClick).not.toHaveBeenCalled();
    expect(deps.customBuilder.getPointIdAt).not.toHaveBeenCalled();
  });
});

describe('edit mode', () => {
  async function editing() {
    await render();
    deps.map.fire('load');
    await enterEditMode();
  }

  it('shows only the custom points while editing', async () => {
    await editing();

    expect(deps.builder.setMarkersVisible).toHaveBeenLastCalledWith(false);
    expect(deps.customBuilder.setVisible).toHaveBeenLastCalledWith(true);
  });

  it('a tap on an empty place opens the editor; saving creates the point on the map and in the state', async () => {
    await editing();

    deps.map.fire('click', tap(69.25, 41.31));
    flushSync();
    const input = document.body.querySelector('input');
    input.value = 'Dom';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    button('ui:map:mapEditor:save').click();
    flushSync();
    await settle();

    const [added] = customPointsState.add.mock.lastCall;
    expect(added).toMatchObject({ coords: { lng: 69.25, lat: 41.31 }, title: 'Dom' });
    expect(deps.customBuilder.addPoint).toHaveBeenCalledWith(expect.objectContaining({ id: added.id, title: 'Dom' }));
  });

  // A new point would hide the article marker under it
  it('a tap next to an article marker is refused with a warning', async () => {
    await editing();
    deps.builder.isMarkerNear.mockReturnValueOnce(true);

    deps.map.fire('click', tap());

    expect(errorToast.warn).toHaveBeenCalledWith('errors:customPointNearHistorical');
  });

  it('a tap on a custom point opens it for editing; deleting removes it everywhere', async () => {
    customPointsState.points.push({
      id: 'p1',
      coords: { lng: 1, lat: 2 },
      title: 'Stary',
      description: '',
      photos: [],
    });
    await editing();
    deps.customBuilder.getPointIdAt.mockReturnValueOnce('p1');

    deps.map.fire('click', tap());
    flushSync();
    expect(document.body.querySelector('input').value).toBe('Stary');

    document.body.querySelectorAll('a')[0].click();
    flushSync();
    button('ui:map:mapEditor:delete').click();
    flushSync();

    expect(deps.customBuilder.removePoint).toHaveBeenCalledWith('p1');
    expect(customPointsState.remove).toHaveBeenCalledWith('p1');
  });
});

describe('leaving the screen', () => {
  it('detaches the click handler and cleans everything up, GPS included', async () => {
    await render();
    deps.map.fire('load');

    unmount(component);
    component = null;

    expect(deps.map.off).toHaveBeenCalledWith('click', expect.any(Function));
    expect(cleanupMap).toHaveBeenCalledWith(expect.objectContaining({ map: deps.map, builder: deps.builder }));
    expect(deps.gps.dispose).toHaveBeenCalled();
  });

  it('gives the navbar and the side panel back', async () => {
    await render();
    expect(navbarState.rightSnippet).not.toBeNull();

    unmount(component);
    component = null;

    expect(navbarState.rightSnippet).toBeNull();
    expect(panelState.contentSnippet).toBeNull();
  });
});
