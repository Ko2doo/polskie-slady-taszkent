/**
 * MapNavigationGPS Module
 *
 * The GPS navigation controller: the GPS mode switch, map taps in that mode, and the "new
 * destination?" dialog. The work itself is done by three parts it wires together:
 * - MapGPSTracking — the live position (watch, first-position flight, user's dot, map area)
 * - MapGPSRoute — the destination and the route to it (build, recalculate, arrival)
 * - MapGPSMessages — every toast the GPS mode shows
 *
 * @example
 * const gps = createGPSNavigationController({ map, builder, i18n });
 *
 * await gps.toggleGPSMode(); // on: starts tracking
 * gps.handleMapClick(event); // sets the destination, or asks first while navigating
 * gps.confirmNewDestination(); // the dialog's "yes"
 * gps.dispose(); // map screen left
 */

import { createGPSMessages } from './MapGPSMessages';
import { createGPSTracking } from './MapGPSTracking.svelte.js';
import { createGPSRoute } from './MapGPSRoute.svelte.js';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const navigationGPSLogger = createLogger('GPSNavigation');

/**
 * Create the GPS navigation controller of one map screen.
 *
 * @param {Object} params - Configuration parameters
 * @param {Object} params.map - MapLibre map instance
 * @param {Object} params.builder - MapPointsBuilder instance (draws the route line)
 * @param {{ t: (key: string) => string }} params.i18n - i18n instance for the toasts
 * @returns {{
 *   readonly gpsMode: boolean, readonly gpsReady: boolean, readonly gpsLoading: boolean,
 *   readonly routeInfo: Object|null, readonly currentRoute: Object|null,
 *   readonly isArrived: boolean, readonly isOutOfBounds: boolean, readonly dialogState: boolean,
 *   toggleGPSMode: () => Promise<void>, clearGPSNavigation: () => void,
 *   handleMapClick: (event: { lngLat: { lng: number, lat: number } }) => void,
 *   openDialog: () => void, closeDialog: () => void, confirmNewDestination: () => void,
 *   dispose: () => void,
 * }} the reactive state the navigation sheet renders, and its actions
 */
export function createGPSNavigationController({ map, builder, i18n }) {
  let gpsMode = $state(false);
  let dialogState = $state(false);
  // A place clicked while navigating, waiting for the "new destination?" dialog's answer
  let pendingDestination = null;

  const messages = createGPSMessages({ i18n });
  const route = createGPSRoute({
    map,
    builder,
    messages,
    getTracker: () => tracking.tracker,
    reportOutOfBounds: () => tracking.reportOutOfBounds(),
  });
  const tracking = createGPSTracking({
    map,
    messages,
    isActive: () => gpsMode,
    onPosition: (position) => route.handlePosition(position),
    // Offline routing can't reach outside the map: the route is dropped
    onLeftMap: () => {
      if (route.currentRoute) clearGPSNavigation();
    },
  });

  /**
   * A map tap in GPS mode: the new destination, or — while a route is being followed — a
   * question first
   * @param {{ lngLat: { lng: number, lat: number } }} event - MapLibre click event
   */
  function handleMapClick(event) {
    if (!gpsMode || !tracking.ready) return;

    if (tracking.isOutOfBounds) {
      messages.outOfBoundsNavigation();
      return;
    }

    const { lng, lat } = event.lngLat;
    const newDestination = { lon: lng, lat };

    if (route.isNavigating) {
      pendingDestination = newDestination;
      openDialog();
      return;
    }

    route.setDestination(newDestination);
  }

  function openDialog() {
    dialogState = true;
  }

  /**
   * Close the "new destination?" dialog; without a confirmation the clicked place is dropped and
   * navigation keeps heading to the current destination
   */
  function closeDialog() {
    dialogState = false;
    pendingDestination = null;
  }

  /**
   * The dialog's "yes": a fresh route to the clicked place
   */
  function confirmNewDestination() {
    const destination = pendingDestination ?? route.destination;
    closeDialog();
    route.restartTo(destination);
  }

  /**
   * Switch GPS mode on (starts tracking) or off (stops it and drops the navigation)
   */
  async function toggleGPSMode() {
    gpsMode = !gpsMode;

    if (gpsMode && !tracking.ready && !tracking.loading) {
      const started = await tracking.start();
      if (!started) gpsMode = false;
    }

    if (!gpsMode) {
      // While tracking is still starting, it stops its own tracker
      if (!tracking.loading) tracking.stop();
      clearGPSNavigation();
      messages.forgetShownErrors();
    }

    IS_DEBUG && navigationGPSLogger.log('GPS mode:', gpsMode);
  }

  /**
   * Drop the destination, the route, the dialog and the user's dot; tracking keeps running
   */
  function clearGPSNavigation() {
    route.clear();
    dialogState = false;
    pendingDestination = null;
    tracking.resetView();

    IS_DEBUG && navigationGPSLogger.log('Navigation cleared');
  }

  /**
   * Map screen left: stop tracking and reset everything, so the controller can start again cleanly
   */
  function dispose() {
    tracking.dispose();
    clearGPSNavigation();
    messages.forgetShownErrors();
    gpsMode = false;

    IS_DEBUG && navigationGPSLogger.log('Disposed');
  }

  return {
    get gpsMode() {
      return gpsMode;
    },
    get gpsReady() {
      return tracking.ready;
    },
    get gpsLoading() {
      return tracking.loading;
    },
    get routeInfo() {
      return route.routeInfo;
    },
    get currentRoute() {
      return route.currentRoute;
    },
    get isArrived() {
      return route.isArrived;
    },
    get isOutOfBounds() {
      return tracking.isOutOfBounds;
    },
    get dialogState() {
      return dialogState;
    },

    toggleGPSMode,
    clearGPSNavigation,
    handleMapClick,
    openDialog,
    closeDialog,
    confirmNewDestination,
    dispose,
  };
}
