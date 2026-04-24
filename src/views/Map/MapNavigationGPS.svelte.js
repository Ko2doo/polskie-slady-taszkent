/**
 * MapNavigationGPS Module
 *
 * GPS-based navigation with real-time tracking and route recalculation.
 *
 * Features:
 * - Real-time GPS position tracking
 * - User location marker on map
 * - Automatic route recalculation when off-route
 * - Route progress tracking
 * - Map bounds checking
 */

import maplibreGL from 'maplibre-gl';
import { createGPSTracker, calculateDistance } from '@/capacitor/services/gpsTracker';
import { initNavigation, findRoute } from '@/services/navigationLoader';
import { errorToast } from '@/store/ui/errorToast';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { ROUTE_FIT_PADDING } from './MapConstants';
// import { openAppSettings, openLocationSettings } from '@/capacitor/services/locationPermission';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const navigationGPSLogger = createLogger('GPSNavigation');

// Configuration
const RECALC_THROTTLE_MS = 10000; // Don't recalculate more often than 10s
const ARRIVAL_DISTANCE_THRESHOLD = 20; // Consider arrived if < 20m from destination

/**
 * Create GPS navigation controller
 *
 * @param {Object} params - Configuration parameters
 * @param {maplibreGL.Map} params.map - MapLibre map instance
 * @param {MapPointsBuilder} params.builder - MapPointsBuilder instance
 * @param {Object} params.i18n - i18n store
 * @returns {Object} - GPS navigation controller API
 */
export function createGPSNavigationController({ map, builder, i18n }) {
  // State
  let gpsMode = $state(false);
  let gpsReady = $state(false);
  let gpsLoading = $state(false);
  let destinationPoint = $state(null);
  let currentRoute = $state(null);
  let routeInfo = $state(null);
  let isArrived = $state(false);
  let isOutOfBounds = $state(false);

  // GPS tracker
  let gpsTracker = null;
  let userMarker = null;
  let lastRecalcTime = 0;
  let pendingRouteBuild = $state(false);
  let didShowWaitingToast = false;

  // Prevents parallel route calculations from racing each other
  let isCalculatingRoute = false;

  let dialogState = $state(false);
  let isFirstPosition = true;

  // Track shown error codes to prevent duplicates
  let shownErrorCodes = new Set();

  function showWaitingForFixOnce() {
    if (didShowWaitingToast) return;
    didShowWaitingToast = true;

    errorToast.info(i18n.t('errors:gpsWaitingForSignal'), {
      scope: 'GPSNavigation',
      code: 'GPS_WAITING_FOR_FIX',
    });
  }

  // ========================================
  // GPS INITIALIZATION
  // ========================================

  /**
   * Initialize GPS tracking
   */
  async function initGPS() {
    if (gpsReady) return true;

    gpsLoading = true;

    // Reset error tracking on init
    shownErrorCodes.clear();

    try {
      // Initialize navigation engine
      await initNavigation();

      // Create GPS tracker
      gpsTracker = createGPSTracker({
        onPositionUpdate: handlePositionUpdate,
        onError: handleGPSError,
      });

      // Start tracking
      const started = await gpsTracker.start();
      if (!started) {
        gpsMode = false;
        return false;
      }

      // Get initial position to check bounds
      const initialPosition = await gpsTracker.getCurrentPosition();

      if (initialPosition && !initialPosition.isWithinBounds) {
        isOutOfBounds = true;

        errorToast.warn(i18n.t('errors:gpsOutOfBounds'), {
          scope: 'GPSNavigation',
          code: 'OUT_OF_BOUNDS',
        });
      } else if (initialPosition) {
        isFirstPosition = false;
        map.flyTo({
          center: [initialPosition.lon, initialPosition.lat],
          zoom: 15,
          duration: 1000,
        });
      }

      gpsReady = true;
      IS_DEBUG && navigationGPSLogger.log('GPS initialized');

      return true;
    } catch (error) {
      IS_DEBUG && navigationGPSLogger.error('Failed to initialize GPS:', error);

      if (error.message !== 'GPS permission denied') {
        errorToast.error(i18n.t('errors:gpsInitFailed'), {
          scope: 'GPSNavigation',
          code: ERROR_CODES.NAV_INIT,
        });
      }

      gpsMode = false;
      return false;
    } finally {
      gpsLoading = false;
    }
  }

  // ========================================
  // MARKER MANAGEMENT
  // ========================================

  /**
   * Create or update user location marker
   */
  function updateUserMarker(position) {
    if (!userMarker) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `
        <div class="pulse-ring"></div>
        <div class="user-dot"></div>
      `;

      userMarker = new maplibreGL.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([position.lon, position.lat])
        .addTo(map);

      IS_DEBUG && navigationGPSLogger.log('User marker created');
    } else {
      userMarker.setLngLat([position.lon, position.lat]);
    }
  }

  /**
   * Remove user location marker
   */
  function removeUserMarker() {
    if (userMarker) {
      userMarker.remove();
      userMarker = null;
    }
  }

  // ========================================
  // POSITION TRACKING
  // ========================================

  /**
   * Handle GPS position updates
   */
  function handlePositionUpdate(position) {
    IS_DEBUG && navigationGPSLogger.log('Position update:', position);

    // First position ever — fly to it regardless of bounds status
    if (isFirstPosition) {
      isFirstPosition = false;

      if (position.isWithinBounds) {
        map.flyTo({
          center: [position.lon, position.lat],
          zoom: 15,
          duration: 1000,
        });
      }
    }

    // Check if position is within map bounds
    if (!position.isWithinBounds) {
      if (!isOutOfBounds) {
        isOutOfBounds = true;

        errorToast.warn(i18n.t('errors:gpsOutOfBounds'), {
          scope: 'GPSNavigation',
          code: 'OUT_OF_BOUNDS',
        });

        if (currentRoute) {
          clearGPSNavigation();
        }
      }

      // Update marker even when out of bounds so user sees their dot
      updateUserMarker(position);
      return;
    }

    // User is back within bounds
    if (isOutOfBounds) {
      isOutOfBounds = false;

      errorToast.info(i18n.t('ui:map:gps:backInBounds'), {
        scope: 'GPSNavigation',
      });
    }

    updateUserMarker(position);

    // Still waiting for first fix before building route
    if (pendingRouteBuild && destinationPoint && !currentRoute) {
      pendingRouteBuild = false;
      calculateRouteFromGPS();
      return;
    }

    // Check if arrived — skip route checks if already arrived
    if (destinationPoint && !isArrived) {
      const distanceToDestination = calculateDistance(
        position.lat,
        position.lon,
        destinationPoint.lat,
        destinationPoint.lon,
      );

      if (distanceToDestination < ARRIVAL_DISTANCE_THRESHOLD) {
        handleArrival();
        return;
      }

      // Check if off route and recalculate — only when not arrived
      if (currentRoute) {
        checkAndRecalculateRoute(position);
      }
    }
  }

  /**
   * Smart error deduplication with priority handling
   */
  function handleGPSError(error) {
    IS_DEBUG && navigationGPSLogger.error('GPS error:', error);

    const errorCode = error.code;

    // Skip if we already showed this error (except timeout which can repeat)
    if (shownErrorCodes.has(errorCode) && errorCode !== ERROR_CODES.OS_PLUG_GLOC_0010) {
      IS_DEBUG && navigationGPSLogger.error('Error already shown, skipping:', errorCode);
      return;
    }

    // Mark as shown
    shownErrorCodes.add(errorCode);

    // Location services disabled - HIGHEST PRIORITY
    if (errorCode === ERROR_CODES.OS_PLUG_GLOC_0007) {
      errorToast.error(i18n.t(`errors:${errorCode}`), {
        scope: 'GPSNavigation',
        code: errorCode,
      });

      return;
    }

    // Location turned off
    if (errorCode === ERROR_CODES.OS_PLUG_GLOC_0017) {
      errorToast.error(i18n.t(`errors:${errorCode}`), {
        scope: 'GPSNavigation',
        code: errorCode,
        action: {
          type: 'openSettings',
          label: i18n.t('ui:buttons:openSettings'),
          handler: async () => {
            IS_DEBUG && navigationGPSLogger.log('Opening location settings...');

            const { openLocationSettings } = await import('@/capacitor/services/locationPermission');
            await openLocationSettings();
          },
        },
      });

      return;
    }

    // Permission denied
    if (errorCode === ERROR_CODES.OS_PLUG_GLOC_0003) {
      errorToast.error(i18n.t(`errors:${errorCode}`), {
        scope: 'GPSNavigation',
        code: errorCode,
        action: {
          type: 'openSettings',
          label: i18n.t('ui:buttons:openSettings'),
          handler: async () => {
            IS_DEBUG && navigationGPSLogger.log('opening app settings...');
            const { openAppSettings } = await import('@/capacitor/services/locationPermission');
            await openAppSettings();
          },
        },
      });

      return;
    }

    // Timeout - waiting for GPS signal (not fatal)
    if (errorCode === ERROR_CODES.OS_PLUG_GLOC_0010) {
      showWaitingForFixOnce();

      // Don't mark timeout as "shown" permanently, remove it for next occurrence
      shownErrorCodes.delete(errorCode);

      return;
    }

    // Position unavailable
    if (errorCode === ERROR_CODES.OS_PLUG_GLOC_0002) {
      errorToast.error(i18n.t(`errors:${errorCode}`), {
        scope: 'GPSNavigation',
        code: errorCode,
      });

      return;
    }

    // Generic error with translation if available
    if (errorCode && errorCode.startsWith('OS_PLUG_GLOC_')) {
      errorToast.error(i18n.t(`errors:${errorCode}`), {
        scope: 'GPSNavigation',
        code: errorCode,
      });

      return;
    }

    // Fallback generic GPS error
    errorToast.error(i18n.t('errors:gpsError'), {
      scope: 'GPSNavigation',
      code: errorCode || 'GPS_ERROR',
    });
  }

  // ========================================
  // ROUTE CALCULATION
  // ========================================

  /**
   * Calculate route from current position to destination.
   * Guards against parallel calls — only one calculation runs at a time.
   */
  async function calculateRouteFromGPS() {
    if (!gpsTracker || !destinationPoint) return;

    // Prevent parallel route calculations from racing
    if (isCalculatingRoute) {
      IS_DEBUG && navigationGPSLogger.log('Route calculation already in progress, skipping');
      return;
    }

    const currentPosition = gpsTracker.lastPosition;

    if (!currentPosition) {
      pendingRouteBuild = true;
      showWaitingForFixOnce();
      return;
    }

    // bounds check
    if (!currentPosition.isWithinBounds) {
      isOutOfBounds = true;

      errorToast.warn(i18n.t('errors:gpsOutOfBounds'), {
        scope: 'GPSNavigation',
        code: 'OUT_OF_BOUNDS',
      });

      if (currentRoute) {
        clearGPSNavigation();
      }

      return;
    }

    IS_DEBUG && navigationGPSLogger.log('Calculating route from GPS position...');

    isCalculatingRoute = true;
    routeInfo = { loading: true };

    try {
      const result = findRoute(currentPosition.lon, currentPosition.lat, destinationPoint.lon, destinationPoint.lat);

      if (result.success) {
        displayRoute(result);
      } else {
        handleRouteError(result);
      }
    } catch (error) {
      IS_DEBUG && navigationGPSLogger.error('Route calculation error:', error);
      routeInfo = null;

      errorToast.error(i18n.t('errors:navigationCalculateRouteFailed'), {
        scope: 'GPSNavigation',
        code: ERROR_CODES.NAV_ROUTE_CALC,
      });
    } finally {
      isCalculatingRoute = false;
    }
  }

  /**
   * Check if user is off route and recalculate if needed
   */
  function checkAndRecalculateRoute(position) {
    if (!currentRoute || !destinationPoint) return;

    // Throttle recalculation
    const now = Date.now();
    if (now - lastRecalcTime < RECALC_THROTTLE_MS) {
      return;
    }

    const offRouteCheck = gpsTracker.checkOffRoute(currentRoute.geometry.coordinates);

    if (offRouteCheck && offRouteCheck.isOffRoute) {
      IS_DEBUG && navigationGPSLogger.log('User is off route, recalculating...', offRouteCheck);

      lastRecalcTime = now;
      calculateRouteFromGPS();
    }
  }

  /**
   * Display calculated route
   */
  function displayRoute(result) {
    currentRoute = result.route;
    routeInfo = {
      distance: result.route.properties.distance,
      nodes: result.route.properties.nodes,
      computeTime: result.route.properties.computeTime,
      iterations: result.route.properties.iterations,
    };

    builder.addNavigationRoute(currentRoute);
    fitMapToRoute(currentRoute);

    IS_DEBUG && navigationGPSLogger.log('Route displayed:', routeInfo);
  }

  /**
   * Handle route calculation error
   */
  function handleRouteError(result) {
    routeInfo = null;

    errorToast.error(i18n.t('errors:navigationRouteNotFound'), {
      scope: 'GPSNavigation',
      code: ERROR_CODES.NAV_ROUTE_NOT_FOUND,
    });

    IS_DEBUG && navigationGPSLogger.error('Route calculation failed:', result.message);
  }

  /**
   * Fit map to show route
   */
  function fitMapToRoute(route) {
    const coordinates = route.geometry.coordinates;
    const bounds = coordinates.reduce(
      (bounds, coord) => bounds.extend(coord),
      new maplibreGL.LngLatBounds(coordinates[0], coordinates[0]),
    );

    map.fitBounds(bounds, { padding: ROUTE_FIT_PADDING });
  }

  // ========================================
  // ARRIVAL HANDLING
  // ========================================

  /**
   * Handle arrival at destination
   */
  function handleArrival() {
    isArrived = true;

    // Clear route state so checkAndRecalculateRoute stops triggering
    currentRoute = null;
    routeInfo = null;

    if (builder) {
      builder.clearNavigationRoute();
    }

    IS_DEBUG && navigationGPSLogger.log('Arrived at destination!');

    errorToast.info(i18n.t('ui:map:gps:arrived'), { scope: 'GPSNavigation' });
  }

  function openDialog() {
    dialogState = true;
  }

  function closeDialog() {
    dialogState = false;
  }

  /**
   * Confirm new destination (from dialog)
   */
  function confirmNewDestination() {
    closeDialog();

    currentRoute = null;
    routeInfo = null;
    isArrived = false;
    lastRecalcTime = 0;
    pendingRouteBuild = false;
    didShowWaitingToast = false;
    isCalculatingRoute = false;

    if (builder) {
      builder.clearNavigationRoute();
    }

    // Reset route progress in tracker so windowed search starts from the beginning
    if (gpsTracker) {
      gpsTracker.resetRoute();
    }

    calculateRouteFromGPS();

    IS_DEBUG && navigationGPSLogger.log('Building new route to:', destinationPoint);
  }

  // ========================================
  // MAP INTERACTION
  // ========================================

  /**
   * Handle map click in GPS mode
   */
  function handleMapClick(e) {
    if (!gpsMode || !gpsReady) return;

    if (isOutOfBounds) {
      errorToast.warn(i18n.t('errors:gpsOutOfBoundsNavigation'), {
        scope: 'GPSNavigation',
        code: 'OUT_OF_BOUNDS_NAVIGATION',
      });
      return;
    }

    const { lng, lat } = e.lngLat;
    const newDestination = { lon: lng, lat };

    if (destinationPoint && currentRoute && !isArrived) {
      destinationPoint = newDestination;
      openDialog();
      return;
    }

    destinationPoint = newDestination;
    isArrived = false;

    pendingRouteBuild = true;
    didShowWaitingToast = false;

    IS_DEBUG && navigationGPSLogger.log('Destination set:', destinationPoint);

    calculateRouteFromGPS();
  }

  // ========================================
  // MODE CONTROL
  // ========================================

  /**
   * Toggle GPS navigation mode
   */
  async function toggleGPSMode() {
    gpsMode = !gpsMode;

    if (gpsMode && !gpsReady && !gpsLoading) {
      const success = await initGPS();
      if (!success) {
        gpsMode = false;
      }
    }

    if (!gpsMode) {
      clearGPSNavigation();
      shownErrorCodes.clear();
    }

    IS_DEBUG && navigationGPSLogger.log('GPS mode:', gpsMode);
  }

  /**
   * Clear GPS navigation state
   */
  function clearGPSNavigation() {
    destinationPoint = null;
    currentRoute = null;
    routeInfo = null;
    isArrived = false;
    lastRecalcTime = 0;
    isCalculatingRoute = false;

    pendingRouteBuild = false;
    didShowWaitingToast = false;

    dialogState = false;
    isFirstPosition = true;

    if (gpsTracker) {
      gpsTracker.resetRoute();
    }

    removeUserMarker();

    if (builder) {
      builder.clearNavigationRoute();
    }

    IS_DEBUG && navigationGPSLogger.log('Navigation cleared');
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Dispose GPS navigation controller
   */
  function dispose() {
    if (gpsTracker) {
      gpsTracker.stop();
      gpsTracker = null;
    }

    clearGPSNavigation();
    shownErrorCodes.clear();

    // Reset ready/mode flags so the controller can be re-initialized cleanly
    gpsReady = false;
    gpsMode = false;
    gpsLoading = false;
    isOutOfBounds = false;

    IS_DEBUG && navigationGPSLogger.log('Disposed');
  }

  // ========================================
  // PUBLIC API
  // ========================================

  return {
    // State (reactive)
    get gpsMode() {
      return gpsMode;
    },
    get gpsReady() {
      return gpsReady;
    },
    get gpsLoading() {
      return gpsLoading;
    },
    get routeInfo() {
      return routeInfo;
    },
    get currentRoute() {
      return currentRoute;
    },
    get isArrived() {
      return isArrived;
    },
    get isOutOfBounds() {
      return isOutOfBounds;
    },
    get dialogState() {
      return dialogState;
    },

    // Actions
    toggleGPSMode,
    clearGPSNavigation,
    handleMapClick,
    openDialog,
    closeDialog,
    confirmNewDestination,
    dispose,
  };
}
