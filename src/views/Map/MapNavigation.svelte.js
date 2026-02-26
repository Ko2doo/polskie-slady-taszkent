/**
 * MapNavigation Module
 *
 * Encapsulates all navigation-related functionality:
 * - Navigation mode state management
 * - Start/end point markers
 * - Route calculation and display
 * - Map click handling
 */

import maplibreGL from 'maplibre-gl';
import { initNavigation, findRoute } from '@/services/navigationLoader';
import { errorToast } from '@/store/ui/errorToast';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { MARKER_CONFIG, MARKER_STYLE, ROUTE_FIT_PADDING } from './MapConstants';

/**
 * Create navigation controller
 *
 * @param {Object} params - Configuration parameters
 * @param {maplibreGL.Map} params.map - MapLibre map instance
 * @param {MapPointsBuilder} params.builder - MapPointsBuilder instance
 * @param {Object} params.i18n - i18n store
 * @returns {Object} - Navigation controller API
 */
export function createNavigationController({ map, builder, i18n }) {
  // State
  let navigationMode = $state(false);
  let navigationReady = $state(false);
  let navigationLoading = $state(false);
  let startPoint = $state(null);
  let endPoint = $state(null);
  let currentRoute = $state(null);
  let routeInfo = $state(null);

  // Markers
  let startMarker = null;
  let endMarker = null;

  let dialogState = $state(false);

  // ========================================
  // MARKER MANAGEMENT
  // ========================================

  /**
   * Create a navigation marker element
   * @private
   */
  function createMarkerElement(type) {
    const config = MARKER_CONFIG.navigation[type];
    const el = document.createElement('div');

    el.className = config.className;
    el.innerHTML = config.icon;
    Object.assign(el.style, MARKER_STYLE);

    return el;
  }

  /**
   * Add marker to map
   * @private
   */
  function addMarker(lon, lat, type) {
    const el = createMarkerElement(type);
    return new maplibreGL.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
  }

  /**
   * Remove marker from map
   * @private
   */
  function removeMarker(marker) {
    if (marker) {
      marker.remove();
      return null;
    }
    return marker;
  }

  /**
   * Set start point and marker
   * @private
   */
  function setStartPoint(lon, lat) {
    startPoint = { lon, lat };
    startMarker = addMarker(lon, lat, 'start');
    console.log('[MapNavigation] Start point set:', startPoint);
  }

  /**
   * Set end point and marker
   * @private
   */
  function setEndPoint(lon, lat) {
    endPoint = { lon, lat };
    endMarker = addMarker(lon, lat, 'end');
    console.log('[MapNavigation] End point set:', endPoint);
  }

  // ========================================
  // NAVIGATION LIFECYCLE
  // ========================================

  /**
   * Load navigation engine
   * @private
   */
  async function loadNavigation() {
    if (navigationReady) return;

    navigationLoading = true;

    try {
      await initNavigation();
      navigationReady = true;
      console.log('[MapNavigation] Navigation engine ready');
    } catch (error) {
      console.error('[MapNavigation] Failed to load navigation:', error);

      errorToast.error(i18n.t('errors:navigationInitFailed'), {
        scope: 'MapNavigation',
        code: ERROR_CODES.NAV_INIT,
      });

      navigationMode = false;
    } finally {
      navigationLoading = false;
    }
  }

  /**
   * Clear all navigation state
   */
  function clearNavigation() {
    try {
      startPoint = null;
      endPoint = null;
      currentRoute = null;
      routeInfo = null;

      startMarker = removeMarker(startMarker);
      endMarker = removeMarker(endMarker);

      if (builder) {
        builder.clearNavigationRoute();
      }

      console.log('[MapNavigation] Navigation cleared');
    } catch (error) {
      console.error('[MapNavigation] Navigation cleared error', error);
    }
  }

  /**
   * Toggle navigation mode
   */
  function toggleNavigationMode() {
    navigationMode = !navigationMode;

    if (navigationMode && !navigationReady && !navigationLoading) {
      loadNavigation();
    }

    if (!navigationMode) {
      clearNavigation();
    }

    console.log('[MapNavigation] Navigation mode:', navigationMode);
  }

  // ========================================
  // ROUTE CALCULATION
  // ========================================

  /**
   * Calculate and display route.
   *
   * Note: findRoute (A*) is synchronous and blocks the JS thread while running.
   * A loading spinner won't render before it completes — if route calc ever
   * becomes slow enough to need a visible loader, move A* to a Web Worker.
   */
  function calculateRoute() {
    if (!startPoint || !endPoint) return;

    console.log('[MapNavigation] Calculating route...');

    try {
      const result = findRoute(startPoint.lon, startPoint.lat, endPoint.lon, endPoint.lat);

      if (result.success) {
        displayRoute(result);
      } else {
        handleRouteError(result);
      }
    } catch (error) {
      console.error('[MapNavigation] Route calculation error:', error);
      routeInfo = null;

      errorToast.error(i18n.t('errors:navigationCalculateRouteFailed'), {
        scope: 'MapNavigation',
        code: ERROR_CODES.NAV_ROUTE_CALC,
      });
    }
  }

  /**
   * Display calculated route on map
   * @private
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

    console.log('[MapNavigation] Route calculated:', routeInfo);
  }

  /**
   * Handle route calculation error
   * @private
   */
  function handleRouteError(result) {
    routeInfo = null;

    errorToast.error(i18n.t('errors:navigationRouteNotFound'), {
      scope: 'MapNavigation',
      code: ERROR_CODES.NAV_ROUTE_NOT_FOUND,
    });

    console.error('[MapNavigation] Route calculation failed:', result.message);
  }

  /**
   * Fit map bounds to show entire route
   * @private
   */
  function fitMapToRoute(route) {
    const coordinates = route.geometry.coordinates;
    const bounds = coordinates.reduce(
      (bounds, coord) => bounds.extend(coord),
      new maplibreGL.LngLatBounds(coordinates[0], coordinates[0]),
    );

    map.fitBounds(bounds, { padding: ROUTE_FIT_PADDING });
  }

  function openDialog() {
    dialogState = true;
  }

  function closeDialog() {
    dialogState = false;
  }

  function confirmNewDestination() {
    closeDialog();
    clearNavigation();
  }

  // ========================================
  // MAP INTERACTION
  // ========================================

  /**
   * Handle map click in navigation mode
   */
  function handleMapClick(e) {
    if (!navigationMode || !navigationReady) return;

    const { lng, lat } = e.lngLat;

    // State machine for navigation point selection
    if (!startPoint) {
      setStartPoint(lng, lat);
    } else if (!endPoint) {
      setEndPoint(lng, lat);
      calculateRoute();
    } else {
      openDialog();
    }
  }

  // ========================================
  // MARKER RESTORATION (for theme changes)
  // ========================================

  /**
   * Restore navigation markers after style change
   */
  function restoreMarkers() {
    startMarker = removeMarker(startMarker);
    endMarker = removeMarker(endMarker);

    if (startPoint) {
      startMarker = addMarker(startPoint.lon, startPoint.lat, 'start');
    }

    if (endPoint) {
      endMarker = addMarker(endPoint.lon, endPoint.lat, 'end');
    }

    console.log('[MapNavigation] Markers restored after style change');
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * Dispose navigation controller
   */
  function dispose() {
    clearNavigation();
    navigationMode = false;
    navigationReady = false;
    navigationLoading = false;
    console.log('[MapNavigation] Disposed');
  }

  // ========================================
  // PUBLIC API
  // ========================================

  return {
    // State (reactive)
    get navigationMode() {
      return navigationMode;
    },
    get navigationReady() {
      return navigationReady;
    },
    get navigationLoading() {
      return navigationLoading;
    },
    get routeInfo() {
      return routeInfo;
    },
    get currentRoute() {
      return currentRoute;
    },
    get dialogState() {
      return dialogState;
    },

    // Actions
    toggleNavigationMode,
    clearNavigation,
    openDialog,
    closeDialog,
    confirmNewDestination,
    handleMapClick,
    restoreMarkers,
    dispose,
  };
}
