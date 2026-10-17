import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { calculateDistance, createGPSTracker, findNearestPointOnRoute } from '@/capacitor/services/gpsTracker';

// Positions need a device: the plugin is a recorder the tests drive. The permission flow is the
// real locationPermission module on top of it.
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
}));

// Routes are laid out in meters north of a point in Tashkent (inside the map bounds)
const ORIGIN = { lon: 69.24, lat: 41.3 };
const METERS_PER_DEGREE_LAT = 111195;
const METERS_PER_DEGREE_LON = METERS_PER_DEGREE_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);

const at = (eastMeters, northMeters) => ({
  lat: ORIGIN.lat + northMeters / METERS_PER_DEGREE_LAT,
  lon: ORIGIN.lon + eastMeters / METERS_PER_DEGREE_LON,
});

// A straight route north, one point every `step` meters, as [lon, lat] pairs
function straightRoute(points, step = 10, eastMeters = 0) {
  return Array.from({ length: points }, (_, index) => {
    const point = at(eastMeters, index * step);
    return [point.lon, point.lat];
  });
}

function capacitorPosition({ lat, lon }, accuracy = 5) {
  return {
    coords: { latitude: lat, longitude: lon, accuracy, altitude: null, heading: null, speed: null },
    timestamp: 1000,
  };
}

const pluginError = (code, message) => Object.assign(new Error(message), { code });

beforeEach(() => {
  // vi.fn()s created inside vi.mock are not reset by restoreMocks
  Object.values(Geolocation).forEach((fn) => fn.mockReset());
  Geolocation.checkPermissions.mockResolvedValue({ location: 'granted' });
  Geolocation.watchPosition.mockResolvedValue('watch-1');
  Geolocation.clearWatch.mockResolvedValue(undefined);
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
});

describe('calculateDistance', () => {
  it('is zero for the same point and ~111.2 km per degree of latitude', () => {
    expect(calculateDistance(41.3, 69.24, 41.3, 69.24)).toBe(0);
    expect(calculateDistance(41, 69, 42, 69)).toBeCloseTo(111195, 0);
  });
});

describe('findNearestPointOnRoute', () => {
  it('measures the distance to the route line, not to its points', () => {
    const route = straightRoute(3, 100);
    const beside = at(20, 50); // 20 m east of the middle of the first segment

    const result = findNearestPointOnRoute(beside, route);

    expect(result.distance).toBeCloseTo(20, 0);
    expect(result.index).toBe(0);
  });

  it('the nearest point is the closer end of the nearest segment', () => {
    const route = straightRoute(3, 100);

    const { nearestPoint } = findNearestPointOnRoute(at(5, 80), route);

    expect(nearestPoint).toEqual({ lat: route[1][1], lon: route[1][0] });
  });

  it('beyond the end of the route measures to the end point', () => {
    const route = straightRoute(3, 100);

    expect(findNearestPointOnRoute(at(0, 230), route).distance).toBeCloseTo(30, 0);
  });

  it('searches only around the last progress on a long route', () => {
    const route = straightRoute(200, 10);
    const nearStart = at(0, 15);

    // Progress at index 100: the start of the route is outside the search window
    expect(findNearestPointOnRoute(nearStart, route, 100).distance).toBeGreaterThan(900);
    expect(findNearestPointOnRoute(nearStart, route, 0).distance).toBeCloseTo(0, 0);
  });

  it('falls back to the whole route when the window is past its end', () => {
    const route = straightRoute(20, 10);

    expect(findNearestPointOnRoute(at(0, 15), route, 100).distance).toBeCloseTo(0, 0);
  });

  it('a route with less than two points has no nearest point', () => {
    expect(findNearestPointOnRoute(at(0, 0), straightRoute(1))).toEqual({
      nearestPoint: null,
      distance: Infinity,
      index: -1,
    });
  });
});

describe('start / stop', () => {
  it('watches the position with high accuracy and no cached fixes', async () => {
    const tracker = createGPSTracker();

    expect(await tracker.start()).toBe(true);
    expect(tracker.isTracking).toBe(true);
    expect(Geolocation.watchPosition).toHaveBeenCalledWith(
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
      expect.any(Function),
    );
  });

  it('a second start does not open a second watch', async () => {
    const tracker = createGPSTracker();
    await tracker.start();

    expect(await tracker.start()).toBe(true);
    expect(Geolocation.watchPosition).toHaveBeenCalledTimes(1);
  });

  it('asks for the permission when it is not granted yet', async () => {
    Geolocation.checkPermissions.mockResolvedValue({ location: 'prompt' });
    Geolocation.requestPermissions.mockResolvedValueOnce({ location: 'granted' });

    expect(await createGPSTracker().start()).toBe(true);
    expect(Geolocation.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('a refused permission: no watch, a permission error', async () => {
    const onError = vi.fn();
    Geolocation.checkPermissions.mockResolvedValue({ location: 'prompt' });
    Geolocation.requestPermissions.mockResolvedValueOnce({ location: 'denied' });

    expect(await createGPSTracker({ onError }).start()).toBe(false);
    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: ERROR_CODES.OS_PLUG_GLOC_0003 }));
  });

  it('on the web: no watch, an error', async () => {
    Capacitor.isNativePlatform.mockReturnValue(false);
    const onError = vi.fn();

    expect(await createGPSTracker({ onError }).start()).toBe(false);
    expect(Geolocation.watchPosition).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: ERROR_CODES.OS_PLUG_GLOC_0002 }));
  });

  it('a failed watch reports a mapped error', async () => {
    const onError = vi.fn();
    Geolocation.watchPosition.mockRejectedValueOnce(Object.assign(new Error('denied'), { code: 1 }));

    expect(await createGPSTracker({ onError }).start()).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: ERROR_CODES.OS_PLUG_GLOC_0003 }));
  });

  it('stop clears the watch and keeps the last position', async () => {
    const tracker = createGPSTracker();
    await tracker.start();
    const onUpdate = Geolocation.watchPosition.mock.lastCall[1];
    onUpdate(capacitorPosition(at(0, 0)));

    await tracker.stop();

    expect(Geolocation.clearWatch).toHaveBeenCalledWith({ id: 'watch-1' });
    expect(tracker.isTracking).toBe(false);
    expect(tracker.lastPosition).not.toBeNull();
  });

  it('stop without a watch does nothing', async () => {
    await createGPSTracker().stop();

    expect(Geolocation.clearWatch).not.toHaveBeenCalled();
  });

  it('a failed clearWatch keeps it tracking (so stop can be retried)', async () => {
    const tracker = createGPSTracker();
    await tracker.start();
    Geolocation.clearWatch.mockRejectedValueOnce(new Error('WatchId not found'));

    await tracker.stop();

    expect(tracker.isTracking).toBe(true);
  });
});

describe('position updates', () => {
  let onPositionUpdate;
  let onError;
  let tracker;
  let update;

  beforeEach(async () => {
    onPositionUpdate = vi.fn();
    onError = vi.fn();
    tracker = createGPSTracker({ onPositionUpdate, onError });
    await tracker.start();
    update = Geolocation.watchPosition.mock.lastCall[1];
  });

  it('passes a position in the app format', () => {
    const point = at(0, 0);

    update(capacitorPosition(point, 8));

    expect(onPositionUpdate).toHaveBeenCalledWith({
      lat: point.lat,
      lon: point.lon,
      accuracy: 8,
      altitude: null,
      heading: null,
      speed: null,
      timestamp: 1000,
      isWithinBounds: true,
    });
  });

  it('flags a position outside the map area', () => {
    update(capacitorPosition({ lat: 52.23, lon: 21.01 }));

    expect(onPositionUpdate.mock.lastCall[0].isWithinBounds).toBe(false);
  });

  it('skips a reading worse than 30 m', () => {
    update(capacitorPosition(at(0, 0), 31));

    expect(onPositionUpdate).not.toHaveBeenCalled();
    expect(tracker.lastPosition).toBeNull();
  });

  it('skips jitter under 5 m, passes real movement', () => {
    update(capacitorPosition(at(0, 0)));
    update(capacitorPosition(at(0, 4)));
    update(capacitorPosition(at(0, 6)));

    expect(onPositionUpdate).toHaveBeenCalledTimes(2);
  });

  it('an empty callback is ignored', () => {
    update(null);

    expect(onPositionUpdate).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('a timeout is reported as "waiting for the signal"', () => {
    update(null, pluginError('OS-PLUG-GLOC-0010', 'Could not obtain location in time. Try with a higher timeout.'));

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: ERROR_CODES.OS_PLUG_GLOC_0010, message: 'Waiting for GPS signal...' }),
    );
  });

  it('other errors are reported with their mapped code', () => {
    update(null, Object.assign(new Error('Permission denied'), { code: 1 }));

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: ERROR_CODES.OS_PLUG_GLOC_0003 }));
  });
});

describe('getCurrentPosition', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns an accurate position at once', async () => {
    Geolocation.getCurrentPosition.mockResolvedValueOnce(capacitorPosition(at(0, 0), 10));

    expect((await createGPSTracker().getCurrentPosition()).accuracy).toBe(10);
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  // The first fix is often a coarse network one: wait for the GPS to converge
  it('retries a coarse fix, then takes the accurate one', async () => {
    Geolocation.getCurrentPosition
      .mockResolvedValueOnce(capacitorPosition(at(0, 0), 200))
      .mockResolvedValueOnce(capacitorPosition(at(0, 0), 12));

    const result = createGPSTracker().getCurrentPosition();
    await vi.advanceTimersByTimeAsync(2000);

    expect((await result).accuracy).toBe(12);
  });

  it('after three coarse fixes takes the last one anyway', async () => {
    Geolocation.getCurrentPosition.mockResolvedValue(capacitorPosition(at(0, 0), 200));

    const result = createGPSTracker().getCurrentPosition();
    await vi.advanceTimersByTimeAsync(4000);

    expect((await result).accuracy).toBe(200);
    expect(Geolocation.getCurrentPosition).toHaveBeenCalledTimes(3);
  });

  it('reports an error only after the last failed attempt', async () => {
    const onError = vi.fn();
    Geolocation.getCurrentPosition.mockRejectedValue(Object.assign(new Error('timeout'), { code: 3 }));

    const result = createGPSTracker({ onError }).getCurrentPosition();
    await vi.advanceTimersByTimeAsync(2000);
    expect(onError).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);

    expect(await result).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: ERROR_CODES.OS_PLUG_GLOC_0010 }));
  });
});

describe('checkOffRoute', () => {
  async function trackerAt(point, accuracy = 0) {
    const tracker = createGPSTracker();
    await tracker.start();
    Geolocation.watchPosition.mock.lastCall[1](capacitorPosition(point, accuracy));
    return { tracker, move: (next) => Geolocation.watchPosition.mock.lastCall[1](capacitorPosition(next, accuracy)) };
  }

  it('is null without a position or a route', async () => {
    const tracker = createGPSTracker();

    expect(tracker.checkOffRoute(straightRoute(3))).toBeNull();

    const { tracker: positioned } = await trackerAt(at(0, 0));
    expect(positioned.checkOffRoute([])).toBeNull();
    expect(positioned.checkOffRoute(null)).toBeNull();
  });

  it('on the route: not off', async () => {
    const { tracker } = await trackerAt(at(10, 50));

    expect(tracker.checkOffRoute(straightRoute(20, 10))).toMatchObject({ isOffRoute: false, threshold: 50 });
  });

  it('more than 50 m away: off', async () => {
    const { tracker } = await trackerAt(at(60, 50));

    expect(tracker.checkOffRoute(straightRoute(20, 10)).isOffRoute).toBe(true);
  });

  // A 25 m accuracy reading 60 m away may really be 35 m away: no false alarm
  it('the GPS accuracy widens the threshold', async () => {
    const { tracker } = await trackerAt(at(60, 50), 25);

    expect(tracker.checkOffRoute(straightRoute(20, 10))).toMatchObject({ isOffRoute: false, threshold: 75 });
  });

  // Walking back inside the small lookback must not drag the search window back with it
  it('a step back does not move the progress back', async () => {
    const route = straightRoute(200, 10);
    const { tracker, move } = await trackerAt(at(0, 400));
    tracker.checkOffRoute(route); // progress: index 39 (the first of the two segments that touch 400 m)

    move(at(0, 345)); // still inside the lookback window
    expect(tracker.checkOffRoute(route).isOffRoute).toBe(false);

    move(at(0, 285)); // 55 m behind the window, which must still start at index 34
    expect(tracker.checkOffRoute(route).isOffRoute).toBe(true);
  });

  it('progress only moves forward, and resetRoute starts over', async () => {
    const route = straightRoute(200, 10);
    const { tracker, move } = await trackerAt(at(0, 400));
    tracker.checkOffRoute(route); // progress: index ~40

    move(at(0, 20)); // back near the start: outside the window around index 40
    expect(tracker.checkOffRoute(route).isOffRoute).toBe(true);

    tracker.resetRoute();
    expect(tracker.checkOffRoute(route).isOffRoute).toBe(false);
  });
});
