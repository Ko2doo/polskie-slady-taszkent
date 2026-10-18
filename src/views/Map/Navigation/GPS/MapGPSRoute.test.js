import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findRoute } from '@/services/navigationLoader';
import { createBuilderRecorder, createMapRecorder, routeResult } from '@/test/mapRecorders';
import { createGPSRoute } from './MapGPSRoute.svelte.js';

vi.mock('maplibre-gl', async () => (await import('@/test/mapRecorders')).maplibreRecorder);
vi.mock('@/services/navigationLoader', () => ({ findRoute: vi.fn() }));

const HOME = { lat: 41.3, lon: 69.24, isWithinBounds: true };
const ABROAD = { lat: 52.23, lon: 21.01, isWithinBounds: false };
const DESTINATION = { lon: 69.26, lat: 41.31 };
const OTHER_DESTINATION = { lon: 69.28, lat: 41.33 };
// ~11 m north of DESTINATION — inside the 20 m arrival radius
const AT_DESTINATION = { lat: 41.3101, lon: 69.26, isWithinBounds: true };
// ~33 m north of DESTINATION — outside it
const NEAR_DESTINATION = { lat: 41.3103, lon: 69.26, isWithinBounds: true };

let map;
let builder;
let messages;
let tracker;
let reportOutOfBounds;
let route;

beforeEach(() => {
  // vi.fn()s created inside vi.mock are not reset by restoreMocks
  findRoute
    .mockReset()
    .mockImplementation((fromLon, fromLat, toLon, toLat) => routeResult([fromLon, fromLat], [toLon, toLat]));

  map = createMapRecorder();
  builder = createBuilderRecorder();
  messages = {
    waitingForFix: vi.fn(),
    forgetWaitingForFix: vi.fn(),
    routeNotFound: vi.fn(),
    routeCalculationFailed: vi.fn(),
  };
  tracker = {
    lastPosition: HOME,
    checkOffRoute: vi.fn(() => ({ isOffRoute: false })),
    resetRoute: vi.fn(),
  };
  reportOutOfBounds = vi.fn();
  route = createGPSRoute({ map, builder, messages, getTracker: () => tracker, reportOutOfBounds });
});

describe('setting a destination', () => {
  it('builds the route from the current position, draws it and fits the map to it', () => {
    route.setDestination(DESTINATION);

    expect(findRoute).toHaveBeenCalledWith(HOME.lon, HOME.lat, DESTINATION.lon, DESTINATION.lat);
    expect(route.destination).toEqual(DESTINATION);
    expect(builder.addNavigationRoute).toHaveBeenCalledWith(route.currentRoute);
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(route.routeInfo).toEqual({ distance: 100, nodes: 2, computeTime: 1, iterations: 3 });
    expect(route.isNavigating).toBe(true);
  });

  it('a new route restarts the tracker progress on it', () => {
    route.setDestination(DESTINATION);

    expect(tracker.resetRoute).toHaveBeenCalledTimes(1);
  });

  it('without a position yet: says it waits, builds with the first position', () => {
    tracker.lastPosition = null;
    route.setDestination(DESTINATION);

    expect(messages.waitingForFix).toHaveBeenCalledTimes(1);
    expect(findRoute).not.toHaveBeenCalled();
    expect(route.isNavigating).toBe(false);

    tracker.lastPosition = HOME;
    route.handlePosition(HOME);

    expect(findRoute).toHaveBeenCalledTimes(1);
    expect(route.currentRoute).not.toBeNull();
  });

  it('allows the "waiting" note again for each new destination', () => {
    route.setDestination(DESTINATION);

    expect(messages.forgetWaitingForFix).toHaveBeenCalledTimes(1);
  });

  it('without a tracker: nothing is built', () => {
    tracker = null;
    route.setDestination(DESTINATION);

    expect(findRoute).not.toHaveBeenCalled();
    expect(route.destination).toEqual(DESTINATION);
  });

  it('from outside the map: reported, nothing built', () => {
    tracker.lastPosition = ABROAD;
    route.setDestination(DESTINATION);

    expect(reportOutOfBounds).toHaveBeenCalledTimes(1);
    expect(findRoute).not.toHaveBeenCalled();
  });

  it('no route: tells the user, no route info', () => {
    findRoute.mockReturnValueOnce({ success: false, message: 'no path' });
    route.setDestination(DESTINATION);

    expect(messages.routeNotFound).toHaveBeenCalledTimes(1);
    expect(route.routeInfo).toBeNull();
    expect(route.currentRoute).toBeNull();
  });

  it('an engine crash: tells the user, does not throw, a later try still works', () => {
    findRoute.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    expect(() => route.setDestination(DESTINATION)).not.toThrow();
    expect(messages.routeCalculationFailed).toHaveBeenCalledTimes(1);
    expect(route.routeInfo).toBeNull();

    route.setDestination(DESTINATION);
    expect(route.currentRoute).not.toBeNull();
  });
});

describe('one calculation at a time', () => {
  it('a destination set while a route is being calculated does not start a second one', () => {
    findRoute.mockImplementationOnce((fromLon, fromLat, toLon, toLat) => {
      route.setDestination(OTHER_DESTINATION);
      return routeResult([fromLon, fromLat], [toLon, toLat]);
    });

    route.setDestination(DESTINATION);

    expect(findRoute).toHaveBeenCalledTimes(1);
  });
});

describe('on the way', () => {
  beforeEach(() => {
    route.setDestination(DESTINATION);
    findRoute.mockClear();
  });

  it('within 20 m of the destination: arrived, the route is gone', () => {
    route.handlePosition(AT_DESTINATION);

    expect(route.isArrived).toBe(true);
    expect(route.currentRoute).toBeNull();
    expect(route.routeInfo).toBeNull();
    expect(route.isNavigating).toBe(false);
    expect(builder.clearNavigationRoute).toHaveBeenCalledTimes(1);
  });

  it('just outside 20 m: not arrived', () => {
    route.handlePosition(NEAR_DESTINATION);

    expect(route.isArrived).toBe(false);
  });

  it('after arriving, positions check nothing', () => {
    route.handlePosition(AT_DESTINATION);
    tracker.checkOffRoute.mockReturnValue({ isOffRoute: true });
    route.handlePosition(HOME);

    expect(tracker.checkOffRoute).not.toHaveBeenCalled();
    expect(findRoute).not.toHaveBeenCalled();
  });

  it('on the route: no recalculation', () => {
    route.handlePosition(HOME);

    expect(tracker.checkOffRoute).toHaveBeenCalledWith(route.currentRoute.geometry.coordinates);
    expect(findRoute).not.toHaveBeenCalled();
  });

  it('off the route: recalculates, then not again within 10 s', () => {
    vi.useFakeTimers();
    try {
      tracker.checkOffRoute.mockReturnValue({ isOffRoute: true });

      route.handlePosition(HOME);
      route.handlePosition(HOME);
      expect(findRoute).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(9999);
      route.handlePosition(HOME);
      expect(findRoute).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(1);
      route.handlePosition(HOME);
      expect(findRoute).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('restartTo', () => {
  it('drops the old route and builds the new one from a reset progress', () => {
    route.setDestination(DESTINATION);
    tracker.resetRoute.mockClear();

    route.restartTo(OTHER_DESTINATION);

    expect(builder.clearNavigationRoute).toHaveBeenCalledTimes(1);
    expect(tracker.resetRoute).toHaveBeenCalledTimes(2); // the reset, then the new route
    expect(findRoute).toHaveBeenLastCalledWith(HOME.lon, HOME.lat, OTHER_DESTINATION.lon, OTHER_DESTINATION.lat);
    expect(route.destination).toEqual(OTHER_DESTINATION);
  });

  it('after the new route ends in an arrival, the next position builds nothing', () => {
    route.setDestination(DESTINATION);
    route.restartTo(OTHER_DESTINATION);
    route.handlePosition({ lat: OTHER_DESTINATION.lat, lon: OTHER_DESTINATION.lon, isWithinBounds: true });
    findRoute.mockClear();

    route.handlePosition(HOME);

    expect(route.isArrived).toBe(true);
    expect(findRoute).not.toHaveBeenCalled();
  });

  it('after arriving, heads off again', () => {
    route.setDestination(DESTINATION);
    route.handlePosition(AT_DESTINATION);

    route.restartTo(OTHER_DESTINATION);

    expect(route.isArrived).toBe(false);
    expect(route.isNavigating).toBe(true);
  });

  it('the recalculation throttle starts over', () => {
    vi.useFakeTimers();
    try {
      tracker.checkOffRoute.mockReturnValue({ isOffRoute: true });
      route.setDestination(DESTINATION);
      route.handlePosition(HOME); // recalculated: the throttle runs

      route.restartTo(OTHER_DESTINATION);
      findRoute.mockClear();
      route.handlePosition(HOME);

      expect(findRoute).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('clear', () => {
  it('forgets the destination and the route, erases the line, restarts the progress', () => {
    route.setDestination(DESTINATION);
    tracker.resetRoute.mockClear();

    route.clear();

    expect(route.destination).toBeNull();
    expect(route.currentRoute).toBeNull();
    expect(route.routeInfo).toBeNull();
    expect(route.isNavigating).toBe(false);
    expect(builder.clearNavigationRoute).toHaveBeenCalledTimes(1);
    expect(tracker.resetRoute).toHaveBeenCalledTimes(1);
  });

  it('a destination waiting for a fix is dropped too', () => {
    tracker.lastPosition = null;
    route.setDestination(DESTINATION);
    route.clear();

    tracker.lastPosition = HOME;
    route.handlePosition(HOME);

    expect(findRoute).not.toHaveBeenCalled();
  });

  it('works without a tracker', () => {
    tracker = null;

    expect(() => route.clear()).not.toThrow();
  });
});
