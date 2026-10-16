import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGPSTracker } from '@/capacitor/services/gpsTracker';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { errorToast } from '@/store/ui/errorToast';
import { findRoute, initNavigation } from '@/services/navigationLoader';
import {
  createBuilderRecorder,
  createdMarkers,
  createMapRecorder,
  markersOnMap,
  routeResult,
} from '@/test/mapRecorders';
import { createGPSNavigationController } from '@/views/Map/MapNavigationGPS.svelte.js';

vi.mock('maplibre-gl', async () => (await import('@/test/mapRecorders')).maplibreRecorder);
vi.mock('@/services/navigationLoader', () => ({ initNavigation: vi.fn(), findRoute: vi.fn() }));
vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

// The tracker is a recorder the test drives: `tracker.move(...)` is a GPS position update.
// calculateDistance stays real (arrival is decided with it).
const deps = vi.hoisted(() => ({}));

vi.mock('@/capacitor/services/gpsTracker', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, createGPSTracker: vi.fn((callbacks) => deps.createTracker(callbacks)) };
});

function createTrackerRecorder({ onPositionUpdate, onError }) {
  const tracker = {
    start: vi.fn(async () => true),
    stopped: false,
    stop: vi.fn(async () => {
      tracker.stopped = true;
    }),
    getCurrentPosition: vi.fn(async () => null),
    checkOffRoute: vi.fn(() => ({ isOffRoute: false })),
    resetRoute: vi.fn(),
    lastPosition: null,
    // A stopped watch sends nothing, like the real one
    move(position) {
      if (tracker.stopped) return;
      tracker.lastPosition = position;
      onPositionUpdate(position);
    },
    fail: (error) => onError(error),
  };
  deps.tracker = tracker;
  return tracker;
}

const i18n = { t: (key) => key };
const HOME = { lat: 41.3, lon: 69.24, isWithinBounds: true };
const DESTINATION = { lng: 69.26, lat: 41.31 };
const OTHER_DESTINATION = { lng: 69.28, lat: 41.33 };
const ABROAD = { lat: 52.23, lon: 21.01, isWithinBounds: false };

const click = ({ lng, lat }) => ({ lngLat: { lng, lat } });

let map;
let builder;
let gps;

async function readyController() {
  await gps.toggleGPSMode();
  expect(gps.gpsReady).toBe(true);
  return deps.tracker;
}

// Ready, at HOME, navigating to DESTINATION
async function navigating() {
  const tracker = await readyController();
  tracker.move(HOME);
  gps.handleMapClick(click(DESTINATION));
  expect(gps.currentRoute).not.toBeNull();
  return tracker;
}

beforeEach(() => {
  // vi.fn()s created inside vi.mock are not reset by restoreMocks
  initNavigation.mockReset().mockResolvedValue({});
  findRoute
    .mockReset()
    .mockImplementation((fromLon, fromLat, toLon, toLat) => routeResult([fromLon, fromLat], [toLon, toLat]));
  Object.values(errorToast).forEach((fn) => fn.mockReset());
  createGPSTracker.mockClear();
  deps.createTracker = createTrackerRecorder;
  createdMarkers.length = 0;

  map = createMapRecorder();
  builder = createBuilderRecorder();
  gps = createGPSNavigationController({ map, builder, i18n });
});

describe('turning GPS mode on', () => {
  it('loads the routing engine, starts tracking and is ready', async () => {
    const tracker = await readyController();

    expect(initNavigation).toHaveBeenCalledTimes(1);
    expect(tracker.start).toHaveBeenCalledTimes(1);
    expect(gps.gpsMode).toBe(true);
    expect(gps.gpsLoading).toBe(false);
  });

  it('flies to the first position inside the map', async () => {
    deps.createTracker = (callbacks) => {
      const tracker = createTrackerRecorder(callbacks);
      tracker.getCurrentPosition.mockResolvedValueOnce(HOME);
      return tracker;
    };

    await readyController();

    expect(map.flyTo).toHaveBeenCalledWith(expect.objectContaining({ center: [HOME.lon, HOME.lat] }));
  });

  it('a first position outside the map: a warning, no flight', async () => {
    deps.createTracker = (callbacks) => {
      const tracker = createTrackerRecorder(callbacks);
      tracker.getCurrentPosition.mockResolvedValueOnce(ABROAD);
      return tracker;
    };

    await readyController();

    expect(gps.isOutOfBounds).toBe(true);
    expect(errorToast.warn).toHaveBeenCalledWith('errors:gpsOutOfBounds', expect.anything());
    expect(map.flyTo).not.toHaveBeenCalled();
  });

  it('tracking that could not start turns the mode off', async () => {
    deps.createTracker = (callbacks) => {
      const tracker = createTrackerRecorder(callbacks);
      tracker.start.mockResolvedValueOnce(false);
      return tracker;
    };

    await gps.toggleGPSMode();

    expect(gps.gpsMode).toBe(false);
    expect(gps.gpsReady).toBe(false);
  });

  it('a failed engine load turns the mode off and tells the user', async () => {
    initNavigation.mockRejectedValueOnce(new Error('404'));

    await gps.toggleGPSMode();

    expect(gps.gpsMode).toBe(false);
    expect(errorToast.error).toHaveBeenCalledWith('errors:gpsInitFailed', expect.anything());
  });
});

describe('user marker', () => {
  it('appears with the first position and then follows it', async () => {
    const tracker = await readyController();

    tracker.move(HOME);
    tracker.move({ ...HOME, lat: 41.301 });

    expect(createdMarkers).toHaveLength(1);
    expect(createdMarkers[0].lngLat).toEqual([HOME.lon, 41.301]);
  });

  it('is shown outside the map area too', async () => {
    const tracker = await readyController();

    tracker.move(ABROAD);

    expect(markersOnMap()).toHaveLength(1);
  });
});

describe('destination and route', () => {
  it('clicks are ignored until GPS is ready', () => {
    gps.handleMapClick(click(DESTINATION));

    expect(findRoute).not.toHaveBeenCalled();
  });

  it('builds the route from the current position to the clicked place', async () => {
    const tracker = await readyController();
    tracker.move(HOME);

    gps.handleMapClick(click(DESTINATION));

    expect(findRoute).toHaveBeenCalledWith(HOME.lon, HOME.lat, DESTINATION.lng, DESTINATION.lat);
    expect(builder.addNavigationRoute).toHaveBeenCalledWith(gps.currentRoute);
    expect(gps.routeInfo).toEqual({ distance: 100, nodes: 2, computeTime: 1, iterations: 3 });
    expect(map.fitBounds).toHaveBeenCalled();
  });

  it('without a position yet: waits for the first fix, then builds the route', async () => {
    const tracker = await readyController();

    gps.handleMapClick(click(DESTINATION));

    expect(findRoute).not.toHaveBeenCalled();
    expect(errorToast.info).toHaveBeenCalledTimes(1);
    expect(errorToast.info).toHaveBeenCalledWith('errors:gpsWaitingForSignal', expect.anything());

    tracker.move(HOME);

    expect(findRoute).toHaveBeenCalledWith(HOME.lon, HOME.lat, DESTINATION.lng, DESTINATION.lat);
  });

  it('outside the map area a destination cannot be set', async () => {
    const tracker = await readyController();
    tracker.move(ABROAD);

    gps.handleMapClick(click(DESTINATION));

    expect(findRoute).not.toHaveBeenCalled();
    expect(errorToast.warn).toHaveBeenCalledWith('errors:gpsOutOfBoundsNavigation', expect.anything());
  });

  it('no route: tells the user', async () => {
    findRoute.mockReturnValueOnce({ success: false, message: 'No path found between points' });
    const tracker = await readyController();
    tracker.move(HOME);

    gps.handleMapClick(click(DESTINATION));

    expect(errorToast.error).toHaveBeenCalledWith('errors:navigationRouteNotFound', expect.anything());
    expect(gps.routeInfo).toBeNull();
  });

  it('a crash in the engine: tells the user, does not throw', async () => {
    findRoute.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const tracker = await readyController();
    tracker.move(HOME);

    gps.handleMapClick(click(DESTINATION));

    expect(errorToast.error).toHaveBeenCalledWith('errors:navigationCalculateRouteFailed', expect.anything());
  });
});

describe('on the way', () => {
  it('arriving within 20 m ends the route', async () => {
    const tracker = await navigating();

    tracker.move({ lat: DESTINATION.lat, lon: DESTINATION.lng + 0.0001, isWithinBounds: true });

    expect(gps.isArrived).toBe(true);
    expect(gps.currentRoute).toBeNull();
    expect(builder.clearNavigationRoute).toHaveBeenCalled();
  });

  it('after arriving, further positions neither check the route nor arrive again', async () => {
    const tracker = await navigating();
    tracker.move({ lat: DESTINATION.lat, lon: DESTINATION.lng, isWithinBounds: true });
    tracker.checkOffRoute.mockClear();
    builder.clearNavigationRoute.mockClear();

    tracker.move({ lat: DESTINATION.lat + 0.0001, lon: DESTINATION.lng, isWithinBounds: true });
    tracker.move({ ...HOME, lat: 41.305 });

    expect(tracker.checkOffRoute).not.toHaveBeenCalled();
    expect(builder.clearNavigationRoute).not.toHaveBeenCalled();
  });

  it('off the route: recalculates from the new position, at most once per 10 s', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100000);
    const tracker = await navigating();
    tracker.checkOffRoute.mockReturnValue({ isOffRoute: true });
    findRoute.mockClear();

    tracker.move({ ...HOME, lat: 41.302 });
    now.mockReturnValue(105000);
    tracker.move({ ...HOME, lat: 41.303 });
    expect(findRoute).toHaveBeenCalledTimes(1);

    now.mockReturnValue(110001);
    tracker.move({ ...HOME, lat: 41.304 });
    expect(findRoute).toHaveBeenCalledTimes(2);
    expect(findRoute).toHaveBeenLastCalledWith(HOME.lon, 41.304, DESTINATION.lng, DESTINATION.lat);
  });

  it('on the route: no recalculation', async () => {
    const tracker = await navigating();
    findRoute.mockClear();

    tracker.move({ ...HOME, lat: 41.302 });

    expect(findRoute).not.toHaveBeenCalled();
  });

  // BUG-14: the new route starts at the user, but the tracker keeps searching it around the old
  // progress — on a long route the user is "off route" again and again (see BUGS.md).
  // Remove `.fails` once fixed.
  it.fails('a recalculated route resets the route progress', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100000);
    const tracker = await navigating();
    tracker.checkOffRoute.mockReturnValue({ isOffRoute: true });
    tracker.resetRoute.mockClear();

    tracker.move({ ...HOME, lat: 41.302 });

    expect(findRoute).toHaveBeenCalledTimes(2);
    expect(tracker.resetRoute).toHaveBeenCalled();
  });

  it('leaving the map area drops the route; coming back says so', async () => {
    const tracker = await navigating();

    tracker.move(ABROAD);
    expect(gps.currentRoute).toBeNull();
    expect(gps.isOutOfBounds).toBe(true);

    tracker.move(HOME);
    expect(gps.isOutOfBounds).toBe(false);
    expect(errorToast.info).toHaveBeenCalledWith('ui:map:gps:backInBounds', expect.anything());
  });
});

describe('a new destination while navigating', () => {
  it('asks first', async () => {
    await navigating();

    gps.handleMapClick(click(OTHER_DESTINATION));

    expect(gps.dialogState).toBe(true);
  });

  it('confirming builds the route to the new place, from a reset progress', async () => {
    const tracker = await navigating();
    gps.handleMapClick(click(OTHER_DESTINATION));
    tracker.resetRoute.mockClear();

    gps.confirmNewDestination();

    expect(gps.dialogState).toBe(false);
    expect(tracker.resetRoute).toHaveBeenCalled();
    expect(findRoute).toHaveBeenLastCalledWith(HOME.lon, HOME.lat, OTHER_DESTINATION.lng, OTHER_DESTINATION.lat);
  });

  // BUG: the click stores the new destination before the dialog, and cancelling does not put the
  // old one back — the old route stays on screen, but recalculation already heads to the new
  // place (see BUGS.md). Remove `.fails` once fixed.
  it.fails('cancelling keeps heading to the old destination', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(100000);
    const tracker = await navigating();
    gps.handleMapClick(click(OTHER_DESTINATION));
    gps.closeDialog();

    tracker.checkOffRoute.mockReturnValue({ isOffRoute: true });
    tracker.move({ ...HOME, lat: 41.302 });

    expect(findRoute).toHaveBeenLastCalledWith(HOME.lon, 41.302, DESTINATION.lng, DESTINATION.lat);
  });
});

describe('GPS errors', () => {
  it('each error code is shown once', async () => {
    const tracker = await readyController();

    tracker.fail({ code: ERROR_CODES.OS_PLUG_GLOC_0002 });
    tracker.fail({ code: ERROR_CODES.OS_PLUG_GLOC_0002 });

    expect(errorToast.error).toHaveBeenCalledTimes(1);
    expect(errorToast.error).toHaveBeenCalledWith(`errors:${ERROR_CODES.OS_PLUG_GLOC_0002}`, expect.anything());
  });

  it('a denied permission offers to open the settings', async () => {
    const tracker = await readyController();

    tracker.fail({ code: ERROR_CODES.OS_PLUG_GLOC_0003 });

    expect(errorToast.error.mock.lastCall[1].action).toMatchObject({
      type: 'openSettings',
      label: 'ui:buttons:openSettings',
    });
  });

  it('location turned off offers to open the location settings', async () => {
    const tracker = await readyController();

    tracker.fail({ code: ERROR_CODES.OS_PLUG_GLOC_0017 });

    expect(errorToast.error.mock.lastCall[1].action.handler).toEqual(expect.any(Function));
  });

  it('a timeout is "waiting for signal", shown once, never an error', async () => {
    const tracker = await readyController();

    tracker.fail({ code: ERROR_CODES.OS_PLUG_GLOC_0010 });
    tracker.fail({ code: ERROR_CODES.OS_PLUG_GLOC_0010 });

    expect(errorToast.info).toHaveBeenCalledTimes(1);
    expect(errorToast.error).not.toHaveBeenCalled();
  });

  it('an unknown error gets the generic message', async () => {
    const tracker = await readyController();

    tracker.fail({ code: 'SOMETHING' });
    tracker.fail({});

    expect(errorToast.error).toHaveBeenCalledWith('errors:gpsError', expect.objectContaining({ code: 'SOMETHING' }));
    expect(errorToast.error).toHaveBeenCalledWith('errors:gpsError', expect.objectContaining({ code: 'GPS_ERROR' }));
  });
});

describe('turning GPS mode off', () => {
  it('clears the destination, the route and the marker', async () => {
    await navigating();

    await gps.toggleGPSMode();

    expect(gps.gpsMode).toBe(false);
    expect(gps.currentRoute).toBeNull();
    expect(markersOnMap()).toHaveLength(0);
  });

  // BUG: turning the mode off only clears the state — the position watch keeps running (battery,
  // the system location indicator) and the next update puts the marker back (see BUGS.md).
  // Remove `.fails` once fixed.
  it.fails('stops tracking: the next position does not bring the marker back', async () => {
    const tracker = await navigating();

    await gps.toggleGPSMode();
    tracker.move({ ...HOME, lat: 41.302 });

    expect(markersOnMap()).toHaveLength(0);
    expect(tracker.stop).toHaveBeenCalled();
  });

  it('dispose stops tracking and resets everything', async () => {
    const tracker = await navigating();

    gps.dispose();

    expect(tracker.stop).toHaveBeenCalled();
    expect(gps.gpsMode).toBe(false);
    expect(gps.gpsReady).toBe(false);
    expect(markersOnMap()).toHaveLength(0);
  });
});
