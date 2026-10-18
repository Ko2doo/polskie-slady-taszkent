/**
 * MapGPSTracking Module
 *
 * The GPS mode's live position: starting the watch (and the routing engine with it), stopping
 * it, flying to the first position, showing the user's dot, and noticing when the user leaves
 * or re-enters the map area. Knows nothing about destinations or routes — positions inside the
 * map go to `onPosition`, leaving it is reported through `onLeftMap`.
 *
 * @example
 * const tracking = createGPSTracking({
 *   map,
 *   messages,
 *   isActive: () => gpsMode, // read after every wait of start()
 *   onPosition: (position) => route.handlePosition(position),
 *   onLeftMap: () => clearNavigation(),
 * });
 *
 * gpsMode = true;
 * if (!(await tracking.start())) gpsMode = false;
 * // GPS mode switched off:
 * if (!tracking.loading) tracking.stop(); // while starting, start() stops its own tracker
 */

import { createGPSTracker } from '@/capacitor/services/gpsTracker';
import { initNavigation } from '@/services/navigationLoader';
import { createUserMarker } from '@/views/Map/Navigation/MapUserMarker';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const gpsTrackingLogger = createLogger('GPSTracking');

const USER_POSITION_ZOOM = 15;
const FLY_TO_USER_MS = 1000;

/**
 * Create the GPS mode's position tracking — one per GPS navigation controller.
 *
 * @param {Object} params - Dependencies and callbacks
 * @param {Object} params.map - MapLibre map instance
 * @param {ReturnType<typeof import('./MapGPSMessages').createGPSMessages>} params.messages - the
 *   controller's message channel (tracker errors, map-area toasts)
 * @param {() => boolean} params.isActive - whether GPS mode is still on; `start()` checks it after
 *   every wait and stops its own tracker if the mode was switched off meanwhile
 * @param {(position: Object) => void} params.onPosition - every position inside the map area,
 *   after the user's dot has moved there
 * @param {() => void} params.onLeftMap - the user has just left the map area (once per exit)
 * @returns {{
 *   readonly ready: boolean, readonly loading: boolean, readonly isOutOfBounds: boolean,
 *   readonly tracker: Object|null,
 *   start: () => Promise<boolean>, stop: () => void, reportOutOfBounds: () => void,
 *   resetView: () => void, dispose: () => void,
 * }} `start` resolves `false` when tracking couldn't start (no permission, engine failure — the
 * user is told) or the mode was switched off meanwhile. `tracker` is the running tracker
 * (`lastPosition`, `checkOffRoute`, `resetRoute`) or `null`.
 */
export function createGPSTracking({ map, messages, isActive, onPosition, onLeftMap }) {
  let ready = $state(false);
  let loading = $state(false);
  let isOutOfBounds = $state(false);

  let tracker = null;
  let isFirstPosition = true;
  const userMarker = createUserMarker(map);

  function flyToUser(position) {
    map.flyTo({ center: [position.lon, position.lat], zoom: USER_POSITION_ZOOM, duration: FLY_TO_USER_MS });
  }

  async function start() {
    if (ready) return true;

    loading = true;
    // A new GPS session reports every error again
    messages.forgetShownErrors();

    try {
      // The routing engine loads with the GPS mode: every destination needs it
      await initNavigation();

      const startingTracker = createGPSTracker({ onPositionUpdate: handlePosition, onError: handleError });
      tracker = startingTracker;

      if (!(await startingTracker.start())) return false;
      if (stopIfSwitchedOff(startingTracker)) return false;

      const initialPosition = await startingTracker.getCurrentPosition();
      if (stopIfSwitchedOff(startingTracker)) return false;

      if (initialPosition && !initialPosition.isWithinBounds) {
        reportOutOfBounds();
      } else if (initialPosition) {
        isFirstPosition = false;
        flyToUser(initialPosition);
      }

      ready = true;
      IS_DEBUG && gpsTrackingLogger.log('GPS initialized');
      return true;
    } catch (error) {
      IS_DEBUG && gpsTrackingLogger.error('Failed to initialize GPS:', error);
      messages.initFailed();
      return false;
    } finally {
      loading = false;
    }
  }

  /**
   * Called by start() after each wait: if GPS mode was switched off meanwhile, stop the tracker it
   * started. Switching off doesn't stop it itself while start() is running — a quick off → on
   * would otherwise leave start() finishing with a stopped tracker and GPS silently dead.
   * @param {Object} startingTracker - the tracker this start() call created
   * @returns {boolean} true if the mode is off and the tracker was stopped
   */
  function stopIfSwitchedOff(startingTracker) {
    if (isActive()) return false;

    startingTracker.stop();
    if (tracker === startingTracker) tracker = null;
    IS_DEBUG && gpsTrackingLogger.log('GPS mode switched off while starting, tracker stopped');
    return true;
  }

  /**
   * Stop the position watch and forget the tracker, so the next start() makes a fresh one. Stops
   * the battery drain and the system "location in use" indicator.
   */
  function stop() {
    if (tracker) {
      tracker.stop();
      tracker = null;
    }
    ready = false;
  }

  function handlePosition(position) {
    IS_DEBUG && gpsTrackingLogger.log('Position update:', position);

    // The first position of a session: fly there if it's on the map
    if (isFirstPosition) {
      isFirstPosition = false;
      if (position.isWithinBounds) flyToUser(position);
    }

    if (!position.isWithinBounds) {
      // Report first: dropping the route resets the view, the dot must come back after it
      if (!isOutOfBounds) reportOutOfBounds();
      // The dot follows the user outside the map area too
      userMarker.show(position);
      return;
    }

    if (isOutOfBounds) {
      isOutOfBounds = false;
      messages.backInBounds();
    }

    userMarker.show(position);
    onPosition(position);
  }

  function handleError(error) {
    IS_DEBUG && gpsTrackingLogger.error('GPS error:', error);
    messages.gpsError(error);
  }

  /**
   * The user is outside the map area: remember it, say so, let the controller drop the route.
   */
  function reportOutOfBounds() {
    isOutOfBounds = true;
    messages.outOfBounds();
    onLeftMap();
  }

  /**
   * Take the user's dot off the map; the next position puts it back and flies there again.
   * Tracking itself keeps running.
   */
  function resetView() {
    userMarker.remove();
    isFirstPosition = true;
  }

  /**
   * Stop everything and forget the session, so the controller can start again cleanly.
   */
  function dispose() {
    stop();
    resetView();
    loading = false;
    isOutOfBounds = false;
  }

  return {
    get ready() {
      return ready;
    },
    get loading() {
      return loading;
    },
    get isOutOfBounds() {
      return isOutOfBounds;
    },
    get tracker() {
      return tracker;
    },
    start,
    stop,
    reportOutOfBounds,
    resetView,
    dispose,
  };
}
