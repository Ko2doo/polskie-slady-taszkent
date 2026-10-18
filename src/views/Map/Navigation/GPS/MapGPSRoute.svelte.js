/**
 * MapGPSRoute Module
 *
 * The GPS mode's way to a destination: building the route from the user's position (or waiting
 * for a first fix), drawing it, recalculating it when the user leaves it (at most once per
 * RECALC_THROTTLE_MS), and noticing the arrival. Gets positions from the tracking module; never
 * starts or stops tracking itself.
 *
 * @example
 * const route = createGPSRoute({
 *   map,
 *   builder,
 *   messages,
 *   getTracker: () => tracking.tracker, // null while GPS isn't running
 *   reportOutOfBounds: () => tracking.reportOutOfBounds(),
 * });
 *
 * route.setDestination({ lon, lat }); // built at once, or with the first fix
 * route.handlePosition(position); // every position on the map
 * route.restartTo(otherPlace); // a new destination while navigating
 * route.clear();
 */

import { calculateDistance } from '@/capacitor/services/gpsTracker';
import { findRoute } from '@/services/navigationLoader';
import { fitMapToRoute } from '@/views/Map/Navigation/MapRouteFit';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const gpsRouteLogger = createLogger('GPSRoute');

const RECALC_THROTTLE_MS = 10000; // don't recalculate an off-route user more often than this
const ARRIVAL_DISTANCE_THRESHOLD = 20; // meters: closer than this to the destination is arrived

/**
 * Create the GPS mode's route — one per GPS navigation controller.
 *
 * @param {Object} params - Dependencies
 * @param {Object} params.map - MapLibre map instance (the camera fits each new route)
 * @param {Object} params.builder - MapPointsBuilder: draws and clears the route line
 * @param {ReturnType<typeof import('./MapGPSMessages').createGPSMessages>} params.messages - the
 *   controller's message channel ("waiting for signal", route failures)
 * @param {() => Object|null} params.getTracker - the running GPS tracker (`lastPosition`,
 *   `checkOffRoute`, `resetRoute`), or null
 * @param {() => void} params.reportOutOfBounds - called when a route would start outside the map
 * @returns {{
 *   readonly destination: {lon: number, lat: number}|null, readonly currentRoute: Object|null,
 *   readonly routeInfo: Object|null, readonly isArrived: boolean, readonly isNavigating: boolean,
 *   setDestination: (point: {lon: number, lat: number}) => void,
 *   restartTo: (point: {lon: number, lat: number}|null) => void,
 *   handlePosition: (position: {lat: number, lon: number}) => void,
 *   clear: () => void,
 * }} `isNavigating` — a route is drawn and the user hasn't arrived yet (a new destination then
 * needs a confirmation). `routeInfo` is `{ loading: true }` while a route is being built.
 */
export function createGPSRoute({ map, builder, messages, getTracker, reportOutOfBounds }) {
  let destination = $state(null);
  let currentRoute = $state(null);
  let routeInfo = $state(null);
  let isArrived = $state(false);

  // A destination set before the first fix: the route is built with the first position
  let pendingRouteBuild = false;
  let lastRecalcTime = 0;
  // Prevents parallel route calculations from racing each other
  let isCalculatingRoute = false;

  /**
   * Forget the route and everything about the way to it; the destination is left to the caller.
   */
  function resetWay() {
    currentRoute = null;
    routeInfo = null;
    isArrived = false;
    lastRecalcTime = 0;
    isCalculatingRoute = false;
    pendingRouteBuild = false;
    messages.forgetWaitingForFix();

    // The tracker's progress belongs to the old route: its windowed search starts over
    getTracker()?.resetRoute();
    builder.clearNavigationRoute();
  }

  function setDestination(point) {
    destination = point;
    isArrived = false;
    pendingRouteBuild = true;
    messages.forgetWaitingForFix();

    IS_DEBUG && gpsRouteLogger.log('Destination set:', destination);
    calculate();
  }

  function restartTo(point) {
    resetWay();
    destination = point;

    IS_DEBUG && gpsRouteLogger.log('Building new route to:', destination);
    calculate();
  }

  function clear() {
    resetWay();
    destination = null;
  }

  /**
   * Calculate the route from the current position to the destination. Without a position yet,
   * waits for the first fix. Guards against parallel calls — only one calculation runs at a time.
   */
  async function calculate() {
    const tracker = getTracker();
    if (!tracker || !destination) return;

    if (isCalculatingRoute) {
      IS_DEBUG && gpsRouteLogger.log('Route calculation already in progress, skipping');
      return;
    }

    const position = tracker.lastPosition;
    if (!position) {
      pendingRouteBuild = true;
      messages.waitingForFix();
      return;
    }

    if (!position.isWithinBounds) {
      reportOutOfBounds();
      return;
    }

    // The position is here: nothing waits for a first fix any more — a flag left set would
    // rebuild the route on the first position after the arrival
    pendingRouteBuild = false;
    IS_DEBUG && gpsRouteLogger.log('Calculating route from GPS position...');
    isCalculatingRoute = true;
    routeInfo = { loading: true };

    try {
      const result = findRoute(position.lon, position.lat, destination.lon, destination.lat);
      if (result.success) {
        showRoute(result.route);
      } else {
        routeInfo = null;
        messages.routeNotFound();
        IS_DEBUG && gpsRouteLogger.error('Route calculation failed:', result.message);
      }
    } catch (error) {
      IS_DEBUG && gpsRouteLogger.error('Route calculation error:', error);
      routeInfo = null;
      messages.routeCalculationFailed();
    } finally {
      isCalculatingRoute = false;
    }
  }

  function showRoute(route) {
    currentRoute = route;
    // Every new route starts at the user: restart the tracker's progress on it, otherwise its
    // windowed search looks around the old route's progress and reports "off route" again
    getTracker()?.resetRoute();
    routeInfo = {
      distance: route.properties.distance,
      nodes: route.properties.nodes,
      computeTime: route.properties.computeTime,
      iterations: route.properties.iterations,
    };

    builder.addNavigationRoute(route);
    fitMapToRoute(map, route);

    IS_DEBUG && gpsRouteLogger.log('Route displayed:', routeInfo);
  }

  function handlePosition(position) {
    // Waiting for the first fix to build the route
    if (pendingRouteBuild && destination && !currentRoute) {
      pendingRouteBuild = false;
      calculate();
      return;
    }

    if (!destination || isArrived) return;

    const distanceToDestination = calculateDistance(position.lat, position.lon, destination.lat, destination.lon);
    if (distanceToDestination < ARRIVAL_DISTANCE_THRESHOLD) {
      arrive();
      return;
    }

    if (currentRoute) recalculateIfOffRoute();
  }

  function recalculateIfOffRoute() {
    const now = Date.now();
    if (now - lastRecalcTime < RECALC_THROTTLE_MS) return;

    const offRouteCheck = getTracker().checkOffRoute(currentRoute.geometry.coordinates);
    if (!offRouteCheck?.isOffRoute) return;

    IS_DEBUG && gpsRouteLogger.log('User is off route, recalculating...', offRouteCheck);
    lastRecalcTime = now;
    calculate();
  }

  function arrive() {
    isArrived = true;
    // Without a route, nothing checks the user against it any more
    currentRoute = null;
    routeInfo = null;
    builder.clearNavigationRoute();

    IS_DEBUG && gpsRouteLogger.log('Arrived at destination!');
    // No toast here: NavigationSheet already shows NavigationArrivalMsg (same "ui:map:gps:arrived"
    // text) for as long as isArrived is true, a toast would just repeat it
  }

  return {
    get destination() {
      return destination;
    },
    get currentRoute() {
      return currentRoute;
    },
    get routeInfo() {
      return routeInfo;
    },
    get isArrived() {
      return isArrived;
    },
    get isNavigating() {
      return Boolean(destination && currentRoute && !isArrived);
    },
    setDestination,
    restartTo,
    handlePosition,
    clear,
  };
}
