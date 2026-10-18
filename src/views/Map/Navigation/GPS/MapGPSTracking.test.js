import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGPSTracker } from '@/capacitor/services/gpsTracker';
import { initNavigation } from '@/services/navigationLoader';
import { createdMarkers, createMapRecorder, markersOnMap } from '@/test/mapRecorders';
import { createTrackerRecorder } from '@/test/gpsTrackerRecorder';
import { createGPSTracking } from './MapGPSTracking.svelte.js';

vi.mock('maplibre-gl', async () => (await import('@/test/mapRecorders')).maplibreRecorder);
vi.mock('@/services/navigationLoader', () => ({ initNavigation: vi.fn() }));

const deps = vi.hoisted(() => ({}));

vi.mock('@/capacitor/services/gpsTracker', async (importOriginal) => ({
  ...(await importOriginal()),
  createGPSTracker: vi.fn((callbacks) => deps.createTracker(callbacks)),
}));

const HOME = { lat: 41.3, lon: 69.24, isWithinBounds: true };
const NEXT = { lat: 41.301, lon: 69.241, isWithinBounds: true };
const ABROAD = { lat: 52.23, lon: 21.01, isWithinBounds: false };

const MESSAGES = [
  'gpsError',
  'waitingForFix',
  'forgetWaitingForFix',
  'forgetShownErrors',
  'outOfBounds',
  'outOfBoundsNavigation',
  'backInBounds',
  'initFailed',
  'routeNotFound',
  'routeCalculationFailed',
];

let map;
let messages;
let active;
let onPosition;
let onLeftMap;
let tracking;

// The tracker the last start() created, with its first answers adjusted before it's used
function nextTracker(adjust = () => {}) {
  deps.createTracker = (callbacks) => {
    deps.tracker = createTrackerRecorder(callbacks);
    adjust(deps.tracker);
    return deps.tracker;
  };
}

beforeEach(() => {
  // vi.fn()s created inside vi.mock are not reset by restoreMocks
  initNavigation.mockReset().mockResolvedValue({});
  createGPSTracker.mockClear();
  nextTracker();
  createdMarkers.length = 0;

  map = createMapRecorder();
  messages = Object.fromEntries(MESSAGES.map((name) => [name, vi.fn()]));
  active = true;
  onPosition = vi.fn();
  onLeftMap = vi.fn();
  tracking = createGPSTracking({ map, messages, isActive: () => active, onPosition, onLeftMap });
});

describe('start', () => {
  it('loads the routing engine, starts the watch and is ready', async () => {
    const starting = tracking.start();
    expect(tracking.loading).toBe(true);

    expect(await starting).toBe(true);
    expect(initNavigation).toHaveBeenCalledTimes(1);
    expect(deps.tracker.start).toHaveBeenCalledTimes(1);
    expect(tracking.ready).toBe(true);
    expect(tracking.loading).toBe(false);
    expect(tracking.tracker).toBe(deps.tracker);
  });

  it('a new session reports every error again', async () => {
    await tracking.start();

    expect(messages.forgetShownErrors).toHaveBeenCalledTimes(1);
  });

  it('when already ready, starts nothing new', async () => {
    await tracking.start();
    expect(await tracking.start()).toBe(true);

    expect(createGPSTracker).toHaveBeenCalledTimes(1);
  });

  it('a watch that could not start: not ready, no error of its own (the tracker told the user)', async () => {
    nextTracker((tracker) => tracker.start.mockResolvedValueOnce(false));

    expect(await tracking.start()).toBe(false);
    expect(tracking.ready).toBe(false);
    expect(tracking.loading).toBe(false);
    expect(messages.initFailed).not.toHaveBeenCalled();
  });

  it('a failed engine load: not ready, the user is told', async () => {
    initNavigation.mockRejectedValueOnce(new Error('no graph'));

    expect(await tracking.start()).toBe(false);
    expect(tracking.ready).toBe(false);
    expect(tracking.loading).toBe(false);
    expect(messages.initFailed).toHaveBeenCalledTimes(1);
  });

  it('a known first position on the map: flies there, the next position does not', async () => {
    nextTracker((tracker) => tracker.getCurrentPosition.mockResolvedValueOnce(HOME));
    await tracking.start();

    expect(map.flyTo).toHaveBeenCalledWith({ center: [HOME.lon, HOME.lat], zoom: 15, duration: 1000 });

    deps.tracker.move(NEXT);
    expect(map.flyTo).toHaveBeenCalledTimes(1);
  });

  it('a known first position outside the map: reported, no flight', async () => {
    nextTracker((tracker) => tracker.getCurrentPosition.mockResolvedValueOnce(ABROAD));
    await tracking.start();

    expect(tracking.ready).toBe(true);
    expect(tracking.isOutOfBounds).toBe(true);
    expect(messages.outOfBounds).toHaveBeenCalledTimes(1);
    expect(onLeftMap).toHaveBeenCalledTimes(1);
    expect(map.flyTo).not.toHaveBeenCalled();
  });

  describe('GPS mode switched off meanwhile', () => {
    it('while the watch starts: stops it, not ready', async () => {
      let finishStart;
      nextTracker((tracker) => {
        tracker.start = vi.fn(() => new Promise((resolve) => (finishStart = () => resolve(true))));
      });

      const starting = tracking.start();
      await vi.waitFor(() => expect(finishStart).toBeTypeOf('function'));
      active = false;
      finishStart();

      expect(await starting).toBe(false);
      expect(deps.tracker.stop).toHaveBeenCalledTimes(1);
      // Stopped right away: no bridge call for a position nobody needs any more
      expect(deps.tracker.getCurrentPosition).not.toHaveBeenCalled();
      expect(tracking.tracker).toBeNull();
      expect(tracking.ready).toBe(false);
    });

    it('while the first position is read: stops it, not ready', async () => {
      nextTracker((tracker) =>
        tracker.getCurrentPosition.mockImplementationOnce(async () => {
          active = false;
          return HOME;
        }),
      );

      expect(await tracking.start()).toBe(false);
      expect(deps.tracker.stop).toHaveBeenCalledTimes(1);
      expect(tracking.ready).toBe(false);
      expect(map.flyTo).not.toHaveBeenCalled();
    });
  });
});

describe('positions', () => {
  beforeEach(async () => {
    await tracking.start();
  });

  it('the first one flies there and puts the dot on the map; the next ones only move it', () => {
    deps.tracker.move(HOME);
    deps.tracker.move(NEXT);

    expect(map.flyTo).toHaveBeenCalledTimes(1);
    expect(markersOnMap()).toHaveLength(1);
    expect(markersOnMap()[0].lngLat).toEqual([NEXT.lon, NEXT.lat]);
  });

  it('positions on the map go on to onPosition', () => {
    deps.tracker.move(HOME);

    expect(onPosition).toHaveBeenCalledWith(HOME);
  });

  it('a first position outside the map: no flight, the dot is still shown', () => {
    deps.tracker.move(ABROAD);

    expect(map.flyTo).not.toHaveBeenCalled();
    expect(markersOnMap()[0].lngLat).toEqual([ABROAD.lon, ABROAD.lat]);
  });

  it('leaving the map: reported once, positions outside do not go on', () => {
    deps.tracker.move(HOME);
    deps.tracker.move(ABROAD);
    deps.tracker.move({ ...ABROAD, lat: 52.24 });

    expect(tracking.isOutOfBounds).toBe(true);
    expect(messages.outOfBounds).toHaveBeenCalledTimes(1);
    expect(onLeftMap).toHaveBeenCalledTimes(1);
    expect(onPosition).toHaveBeenCalledTimes(1);
  });

  it('leaving the map keeps the dot even when the controller resets the view on it', () => {
    onLeftMap.mockImplementation(() => tracking.resetView());

    deps.tracker.move(HOME);
    deps.tracker.move(ABROAD);

    expect(markersOnMap()).toHaveLength(1);
    expect(markersOnMap()[0].lngLat).toEqual([ABROAD.lon, ABROAD.lat]);
  });

  it('coming back: says so, positions go on again', () => {
    deps.tracker.move(ABROAD);
    deps.tracker.move(HOME);

    expect(tracking.isOutOfBounds).toBe(false);
    expect(messages.backInBounds).toHaveBeenCalledTimes(1);
    expect(onPosition).toHaveBeenCalledWith(HOME);
  });

  it('tracker errors go to the message channel', () => {
    const error = { code: 'SOMETHING' };
    deps.tracker.fail(error);

    expect(messages.gpsError).toHaveBeenCalledWith(error);
  });
});

describe('reportOutOfBounds', () => {
  it('marks the user outside, says so and tells the controller', () => {
    tracking.reportOutOfBounds();

    expect(tracking.isOutOfBounds).toBe(true);
    expect(messages.outOfBounds).toHaveBeenCalledTimes(1);
    expect(onLeftMap).toHaveBeenCalledTimes(1);
  });
});

describe('resetView', () => {
  it('takes the dot off; the next position brings it back and flies there again', async () => {
    await tracking.start();
    deps.tracker.move(HOME);

    tracking.resetView();
    expect(markersOnMap()).toHaveLength(0);

    deps.tracker.move(NEXT);
    expect(markersOnMap()).toHaveLength(1);
    expect(map.flyTo).toHaveBeenCalledTimes(2);
  });
});

describe('stop and dispose', () => {
  it('stop ends the watch: not ready, no tracker, nothing more arrives', async () => {
    await tracking.start();
    const tracker = deps.tracker;

    tracking.stop();
    tracker.move(HOME);

    expect(tracker.stop).toHaveBeenCalledTimes(1);
    expect(tracking.ready).toBe(false);
    expect(tracking.tracker).toBeNull();
    expect(onPosition).not.toHaveBeenCalled();
  });

  it('stop without a tracker does nothing', () => {
    expect(() => tracking.stop()).not.toThrow();
  });

  it('the next start after stop makes a fresh tracker', async () => {
    await tracking.start();
    tracking.stop();
    await tracking.start();

    expect(createGPSTracker).toHaveBeenCalledTimes(2);
    expect(tracking.ready).toBe(true);
  });

  it('dispose stops the watch and forgets the session', async () => {
    await tracking.start();
    deps.tracker.move(ABROAD);

    tracking.dispose();

    expect(deps.tracker.stop).toHaveBeenCalledTimes(1);
    expect(tracking.ready).toBe(false);
    expect(tracking.isOutOfBounds).toBe(false);
    expect(markersOnMap()).toHaveLength(0);
  });
});
