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
  let isOutOfBounds = $state(false); // Track if user is outside map bounds

  // GPS tracker
  let gpsTracker = null;
  let userMarker = null;
  let lastRecalcTime = 0;
  let pendingRouteBuild = $state(false);
  let didShowWaitingToast = false;

  function showWaitingForFixOnce() {
    if (didShowWaitingToast) return;
    didShowWaitingToast = true;

    errorToast.info(i18n.t('ui:errors:gpsWaitingForSignal'), {
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
        // throw new Error('Failed to start GPS tracking');
        gpsMode = false;
        return false;
      }

      // Get initial position to check bounds
      const initialPosition = await gpsTracker.getCurrentPosition();

      if (initialPosition && !initialPosition.isWithinBounds) {
        // User is outside map bounds
        isOutOfBounds = true;

        errorToast.warn(i18n.t('ui:errors:gpsOutOfBounds'), {
          scope: 'GPSNavigation',
          code: 'OUT_OF_BOUNDS',
        });
      }

      gpsReady = true;
      console.log('[GPSNavigation] GPS initialized');

      return true;
    } catch (error) {
      console.error('[GPSNavigation] Failed to initialize GPS:', error);

      if (error.message !== 'GPS permission denied') {
        errorToast.error(i18n.t('ui:errors:gpsInitFailed'), {
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
      // Create marker element
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

      console.log('[GPSNavigation] User marker created');
    } else {
      // Update marker position
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
    console.log('[GPSNavigation] Position update:', position);

    // Check if position is within map bounds
    if (!position.isWithinBounds) {
      if (!isOutOfBounds) {
        // First time out of bounds
        isOutOfBounds = true;

        errorToast.warn(i18n.t('ui:errors:gpsOutOfBounds'), {
          scope: 'GPSNavigation',
          code: 'OUT_OF_BOUNDS',
        });

        // Clear route if exists
        if (currentRoute) {
          clearGPSNavigation();
        }
      }

      // Update marker position even if out of bounds
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

    // Update user marker
    updateUserMarker(position);

    // wait for fix mode
    if (pendingRouteBuild && destinationPoint && !currentRoute) {
      pendingRouteBuild = false;
      calculateRouteFromGPS();

      return;
    }

    // Check if arrived
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
    }

    // Check if off route and recalculate
    if (currentRoute && destinationPoint) {
      checkAndRecalculateRoute(position);
    }
  }

  /**
   * Handle GPS errors
   */
  function handleGPSError(error) {
    console.error('[GPSNavigation] GPS error:', error);

    // Permission denied -> show action "Open settings"
    if (error.code === 'PERMISSION_DENIED') {
      // errorToast.error(i18n.t('ui:errors:gpsPermissionDenied'), {
      //   scope: 'GPSNavigation',
      //   code: error.code,
      //   duration: 8000,
      //   action: {
      //     text: i18n.t('ui:buttons:openSettings'),

      //     onClick: async () => {
      //       try {
      //         const { Capacitor } = await import('@capacitor/core');

      //         if (!Capacitor.isNativePlatform()) {
      //           // В браузере "настройки приложения" не откроешь
      //           errorToast.info(i18n.t('ui:hints:enableGPSManually'));
      //           return;
      //         }

      //         const { App } = await import('@capacitor/app');

      //         if (typeof App.openSettings === 'function') {
      //           await App.openSettings();
      //           return;
      //         }

      //         errorToast.info(i18n.t('ui:hints:enableGPSManually'));
      //       } catch (e) {
      //         console.error('[GPSNavigation] Cannot open settings:', e);
      //         errorToast.info(i18n.t('ui:hints:enableGPSManually'));
      //       }
      //     },
      //   },
      // });

      errorToast.error(i18n.t('ui:errors:gpsPermissionDenied'), {
        scope: 'GPSNavigation',
        code: error.code,
      });

      return;
    }

    if (error.code === 'GPS_TIMEOUT') {
      // errorToast.info(i18n.t('ui:errors:gpsWaitingForSignal'), {
      //   scope: 'GPSNavigation',
      //   code: 'GPS_TIMEOUT',
      // });
      showWaitingForFixOnce();
      return;
    }

    errorToast.error(i18n.t('ui:errors:gpsError'), {
      scope: 'GPSNavigation',
      code: error.code || 'GPS_ERROR',
    });
  }

  // ========================================
  // ROUTE CALCULATION
  // ========================================

  /**
   * Calculate route from current position to destination
   */
  async function calculateRouteFromGPS() {
    if (!gpsTracker || !destinationPoint) return;

    const currentPosition = gpsTracker.lastPosition;

    if (!currentPosition) {
      pendingRouteBuild = true;
      showWaitingForFixOnce();
      return;
    }

    // bounds check
    if (!currentPosition.isWithinBounds) {
      isOutOfBounds = true;

      errorToast.warn(i18n.t('ui:errors:gpsOutOfBounds'), {
        scope: 'GPSNavigation',
        code: 'OUT_OF_BOUNDS',
      });

      // clear route if any (you already do this on live updates)
      if (currentRoute) {
        clearGPSNavigation();
      }

      return;
    }

    console.log('[GPSNavigation] Calculating route from GPS position...');

    // Show loading
    routeInfo = { loading: true };

    try {
      const result = findRoute(currentPosition.lon, currentPosition.lat, destinationPoint.lon, destinationPoint.lat);

      if (result.success) {
        displayRoute(result);
      } else {
        handleRouteError(result);
      }
    } catch (error) {
      console.error('[GPSNavigation] Route calculation error:', error);
      routeInfo = null;

      errorToast.error(i18n.t('ui:errors:navigationCalculateRouteFailed'), {
        scope: 'GPSNavigation',
        code: ERROR_CODES.NAV_ROUTE_CALC,
      });
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

    // Check if off route
    const offRouteCheck = gpsTracker.checkOffRoute(currentRoute.geometry.coordinates);

    if (offRouteCheck && offRouteCheck.isOffRoute) {
      console.log('[GPSNavigation] User is off route, recalculating...', offRouteCheck);

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

    console.log('[GPSNavigation] Route displayed:', routeInfo);
  }

  /**
   * Handle route calculation error
   */
  function handleRouteError(result) {
    routeInfo = null;

    errorToast.error(i18n.t('ui:errors:navigationRouteNotFound'), {
      scope: 'GPSNavigation',
      code: ERROR_CODES.NAV_ROUTE_NOT_FOUND,
    });

    console.error('[GPSNavigation] Route calculation failed:', result.message);
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

    console.log('[GPSNavigation] Arrived at destination!');

    // Show success message
    errorToast.info(i18n.t('ui:map:gps:arrived'), {
      scope: 'GPSNavigation',
    });

    // Stop tracking but keep GPS on for next navigation
    // User can manually stop GPS mode
  }

  // ========================================
  // MAP INTERACTION
  // ========================================

  /**
   * Handle map click in GPS mode
   */
  function handleMapClick(e) {
    if (!gpsMode || !gpsReady) return;

    // Check if user is out of bounds
    if (isOutOfBounds) {
      errorToast.warn(i18n.t('ui:errors:gpsOutOfBoundsNavigation'), {
        scope: 'GPSNavigation',
        code: 'OUT_OF_BOUNDS_NAVIGATION',
      });
      return;
    }

    const { lng, lat } = e.lngLat;

    // Set destination
    destinationPoint = { lon: lng, lat };
    isArrived = false;

    // Wait for fix mode
    pendingRouteBuild = true;
    didShowWaitingToast = false;

    console.log('[GPSNavigation] Destination set:', destinationPoint);

    // Calculate route from current GPS position
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
    }

    console.log('[GPSNavigation] GPS mode:', gpsMode);
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

    pendingRouteBuild = false;
    didShowWaitingToast = false;

    removeUserMarker();

    if (builder) {
      builder.clearNavigationRoute();
    }

    console.log('[GPSNavigation] Navigation cleared');
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

    console.log('[GPSNavigation] Disposed');
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

    // Actions
    toggleGPSMode,
    clearGPSNavigation,
    handleMapClick,
    dispose,
  };
}
