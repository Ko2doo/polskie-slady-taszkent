import { describe, it, expect, vi, beforeEach } from 'vitest';
import { errorToast } from '@/store/ui/errorToast';
import { findRoute, initNavigation } from '@/services/navigationLoader';
import {
  createBuilderRecorder,
  createdMarkers,
  createMapRecorder,
  markersOnMap,
  routeResult,
} from '@/test/mapRecorders';
import { createNavigationController } from './MapNavigation.svelte.js';

vi.mock('maplibre-gl', async () => (await import('@/test/mapRecorders')).maplibreRecorder);
vi.mock('@/services/navigationLoader', () => ({ initNavigation: vi.fn(), findRoute: vi.fn() }));
vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const i18n = { t: (key) => key };
const click = (lng, lat) => ({ lngLat: { lng, lat } });

let map;
let builder;
let navigation;

async function readyController() {
  navigation.toggleNavigationMode();
  await vi.waitFor(() => expect(navigation.navigationReady).toBe(true));
}

beforeEach(() => {
  // vi.fn()s created inside vi.mock are not reset by restoreMocks
  initNavigation.mockReset().mockResolvedValue({});
  findRoute
    .mockReset()
    .mockImplementation((fromLon, fromLat, toLon, toLat) => routeResult([fromLon, fromLat], [toLon, toLat]));
  Object.values(errorToast).forEach((fn) => fn.mockReset());
  createdMarkers.length = 0;

  map = createMapRecorder();
  builder = createBuilderRecorder();
  navigation = createNavigationController({ map, builder, i18n });
});

describe('mode', () => {
  it('turning it on loads the routing engine once', async () => {
    await readyController();
    navigation.toggleNavigationMode();
    navigation.toggleNavigationMode();

    expect(initNavigation).toHaveBeenCalledTimes(1);
    expect(navigation.navigationMode).toBe(true);
  });

  it('is loading while the engine loads', () => {
    initNavigation.mockReturnValueOnce(new Promise(() => {}));

    navigation.toggleNavigationMode();

    expect(navigation.navigationLoading).toBe(true);
  });

  it('a failed engine load turns the mode off and tells the user', async () => {
    initNavigation.mockRejectedValueOnce(new Error('404'));

    navigation.toggleNavigationMode();

    await vi.waitFor(() => expect(navigation.navigationLoading).toBe(false));
    expect(navigation.navigationMode).toBe(false);
    expect(errorToast.error).toHaveBeenCalledWith('errors:navigationInitFailed', expect.anything());
  });

  it('turning it off clears the points, the markers and the route', async () => {
    await readyController();
    navigation.handleMapClick(click(69.24, 41.3));
    navigation.handleMapClick(click(69.25, 41.31));

    navigation.toggleNavigationMode();

    expect(markersOnMap()).toHaveLength(0);
    expect(navigation.currentRoute).toBeNull();
    expect(navigation.routeInfo).toBeNull();
    expect(builder.clearNavigationRoute).toHaveBeenCalled();
  });
});

describe('picking the points', () => {
  it('clicks are ignored while the mode is off or the engine is still loading', () => {
    navigation.handleMapClick(click(69.24, 41.3));

    initNavigation.mockReturnValueOnce(new Promise(() => {}));
    navigation.toggleNavigationMode();
    navigation.handleMapClick(click(69.24, 41.3));

    expect(createdMarkers).toHaveLength(0);
  });

  it('first click: start marker; second click: end marker and the route', async () => {
    await readyController();

    navigation.handleMapClick(click(69.24, 41.3));
    expect(markersOnMap()).toHaveLength(1);
    expect(findRoute).not.toHaveBeenCalled();

    navigation.handleMapClick(click(69.25, 41.31));

    expect(markersOnMap().map((marker) => marker.lngLat)).toEqual([
      [69.24, 41.3],
      [69.25, 41.31],
    ]);
    expect(findRoute).toHaveBeenCalledWith(69.24, 41.3, 69.25, 41.31);
  });

  it('shows the route, its info, and fits the map to it', async () => {
    await readyController();
    navigation.handleMapClick(click(69.24, 41.3));
    navigation.handleMapClick(click(69.25, 41.31));

    expect(builder.addNavigationRoute).toHaveBeenCalledWith(navigation.currentRoute);
    expect(navigation.routeInfo).toEqual({ distance: 100, nodes: 2, computeTime: 1, iterations: 3 });
    expect(map.fitBounds.mock.lastCall[0].points).toEqual(
      expect.arrayContaining([
        [69.24, 41.3],
        [69.25, 41.31],
      ]),
    );
  });

  it('a third click asks before starting over', async () => {
    await readyController();
    navigation.handleMapClick(click(69.24, 41.3));
    navigation.handleMapClick(click(69.25, 41.31));

    navigation.handleMapClick(click(69.26, 41.32));

    expect(navigation.dialogState).toBe(true);
    expect(markersOnMap()).toHaveLength(2);
  });

  it('confirming starts over, the next click is a new start', async () => {
    await readyController();
    navigation.handleMapClick(click(69.24, 41.3));
    navigation.handleMapClick(click(69.25, 41.31));
    navigation.handleMapClick(click(69.26, 41.32));

    navigation.confirmNewDestination();
    navigation.handleMapClick(click(69.27, 41.33));

    expect(navigation.dialogState).toBe(false);
    expect(markersOnMap().map((marker) => marker.lngLat)).toEqual([[69.27, 41.33]]);
  });

  it('cancelling keeps the route', async () => {
    await readyController();
    navigation.handleMapClick(click(69.24, 41.3));
    navigation.handleMapClick(click(69.25, 41.31));
    navigation.handleMapClick(click(69.26, 41.32));

    navigation.closeDialog();

    expect(navigation.currentRoute).not.toBeNull();
    expect(markersOnMap()).toHaveLength(2);
  });
});

describe('route errors', () => {
  it('no route: tells the user, no route shown', async () => {
    findRoute.mockReturnValueOnce({ success: false, message: 'No path found between points' });
    await readyController();

    navigation.handleMapClick(click(69.24, 41.3));
    navigation.handleMapClick(click(69.25, 41.31));

    expect(errorToast.error).toHaveBeenCalledWith('errors:navigationRouteNotFound', expect.anything());
    expect(navigation.routeInfo).toBeNull();
    expect(builder.addNavigationRoute).not.toHaveBeenCalled();
  });

  it('a crash in the engine: tells the user, does not throw', async () => {
    findRoute.mockImplementationOnce(() => {
      throw new Error('Navigation engine not initialized');
    });
    await readyController();

    navigation.handleMapClick(click(69.24, 41.3));
    expect(() => navigation.handleMapClick(click(69.25, 41.31))).not.toThrow();

    expect(errorToast.error).toHaveBeenCalledWith('errors:navigationCalculateRouteFailed', expect.anything());
  });
});

describe('restoreMarkers / dispose', () => {
  // A style change wipes the markers' layer: they are recreated at the same places
  it('restoreMarkers recreates the markers in place', async () => {
    await readyController();
    navigation.handleMapClick(click(69.24, 41.3));
    navigation.handleMapClick(click(69.25, 41.31));

    navigation.restoreMarkers();

    expect(createdMarkers).toHaveLength(4);
    expect(markersOnMap().map((marker) => marker.lngLat)).toEqual([
      [69.24, 41.3],
      [69.25, 41.31],
    ]);
  });

  it('dispose clears everything and resets the flags', async () => {
    await readyController();
    navigation.handleMapClick(click(69.24, 41.3));

    navigation.dispose();

    expect(markersOnMap()).toHaveLength(0);
    expect(navigation.navigationMode).toBe(false);
    expect(navigation.navigationReady).toBe(false);
  });
});
