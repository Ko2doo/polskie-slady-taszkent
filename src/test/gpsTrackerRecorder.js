/**
 * Test-only recorder of `createGPSTracker()` (capacitor/services/gpsTracker.js): the test drives
 * it — `tracker.move(position)` is a GPS position update, `tracker.fail(error)` a tracker error.
 *
 * Usage, inside a test file:
 *   const deps = vi.hoisted(() => ({}));
 *   vi.mock('@/capacitor/services/gpsTracker', async (importOriginal) => ({
 *     ...(await importOriginal()),
 *     createGPSTracker: vi.fn((callbacks) => (deps.tracker = createTrackerRecorder(callbacks))),
 *   }));
 */
import { vi } from 'vitest';

/**
 * A tracker that starts, has no position until moved, and is on the route until told otherwise.
 * @param {{ onPositionUpdate: Function, onError: Function }} callbacks - what createGPSTracker got
 * @returns {Object} the recorder: the tracker's API as `vi.fn`s plus `move`/`fail`/`stopped`
 */
export function createTrackerRecorder({ onPositionUpdate, onError }) {
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
  return tracker;
}
