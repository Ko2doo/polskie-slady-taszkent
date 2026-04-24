import { createLogger, IS_DEBUG } from '@/utils/debugMode';

/**
 * MapLifecycle Module
 *
 * Manages map initialization and cleanup:
 * - PMTiles loading
 * - MapLibre instance creation
 * - Initial style loading
 * - Cleanup on component unmount
 */

import maplibreGL from 'maplibre-gl';
import { PMTiles, Protocol } from 'pmtiles';
import { InMemoryPMTilesSource } from '@/utils/inMemoryPmtilesSource';
import { errorToast } from '@/store/ui/errorToast';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { PMTILES_PATH, PMTILES_KEY, INITIAL_VIEW, MAP_BOUNDS } from './MapConstants';

const lifecycleLogger = createLogger('MapLifecycle');

/**
 * Initialize PMTiles source
 *
 * @param {Object} i18n - i18n store for error messages
 * @returns {Promise<Protocol>} - PMTiles protocol instance
 */
export async function initializePMTiles(i18n) {
  IS_DEBUG && lifecycleLogger.log('Loading PMTiles...');

  try {
    const response = await fetch(PMTILES_PATH);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const src = new InMemoryPMTilesSource(PMTILES_KEY, buffer);
    const pmtiles = new PMTiles(src);

    const protocol = new Protocol();
    maplibreGL.addProtocol('pmtiles', protocol.tile);
    protocol.add(pmtiles);

    IS_DEBUG && lifecycleLogger.log('PMTiles loaded successfully');
    return protocol;
  } catch (error) {
    IS_DEBUG && lifecycleLogger.error('Failed to load PMTiles:', error);

    errorToast.error(i18n.t('errors:mapPMTilesFetch'), {
      scope: 'MapLifecycle',
      code: ERROR_CODES.PMTILES_FETCH,
    });

    throw error;
  }
}

/**
 * Initialize MapLibre map instance
 *
 * @param {Object} params - Initialization parameters
 * @param {HTMLElement} params.container - DOM container element
 * @param {Object} params.style - MapLibre style object
 * @returns {maplibreGL.Map} - Initialized map instance
 */
export function initializeMap({ container, style }) {
  IS_DEBUG && lifecycleLogger.log('Creating MapLibre instance...');

  const map = new maplibreGL.Map({
    container,
    style,
    attributionControl: false,
    ...INITIAL_VIEW,
  });

  // Custom attribution
  map.addControl(
    new maplibreGL.AttributionControl({
      compact: true,
      customAttribution:
        '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org">OpenStreetMap</a>',
    }),
    'top-left',
  );

  IS_DEBUG && lifecycleLogger.log('MapLibre instance created');
  return map;
}

/**
 * Setup map event handlers after initialization
 *
 * @param {Object} params - Setup parameters
 * @param {maplibreGL.Map} params.map - Map instance
 * @param {MapPointsBuilder} params.builder - Builder instance
 * @param {Object} params.navigation - Navigation controller
 * @param {Array|null} params.targetCoords - Optional coordinates to fly to
 *
 * NOTE: Navigation click handlers are managed in Map.svelte via handleUnifiedMapClick
 */
export function setupMapHandlers({ map, builder, targetCoords }) {
  IS_DEBUG && lifecycleLogger.log('Setting up map handlers...');

  map.setMaxBounds(MAP_BOUNDS);
  IS_DEBUG && lifecycleLogger.log('MaxBounds set:', MAP_BOUNDS);

  // Add all overlays
  builder.addCityBoundaryLayer();
  builder.addMarkers();

  // DON'T attach navigation click handler here - it's handled in Map.svelte
  // via handleUnifiedMapClick which routes to correct navigation controller

  // Fly to target coordinates if provided
  if (targetCoords) {
    map.flyTo({
      center: targetCoords,
      zoom: 16,
    });
    IS_DEBUG && lifecycleLogger.log('Flying to target coordinates:', targetCoords);
  }

  IS_DEBUG && lifecycleLogger.log('Map handlers ready');
}

/**
 * Cleanup map resources
 *
 * IMPORTANT: Order matters! Controllers must be disposed BEFORE map.remove()
 * because they may need to interact with map layers/sources during cleanup.
 *
 * @param {Object} params - Cleanup parameters
 * @param {maplibreGL.Map} params.map - Map instance to cleanup
 * @param {Protocol} params.protocol - PMTiles protocol to cleanup
 * @param {MapPointsBuilder} params.builder - Builder instance to cleanup
 * @param {Object} params.navigation - Navigation controller to cleanup
 * @param {Object} params.theme - Theme controller to cleanup
 */
export function cleanupMap({ map, protocol, builder, navigation, theme }) {
  IS_DEBUG && lifecycleLogger.log('Cleaning up map resources...');

  // 1. Dispose controllers FIRST (they need map to be alive)
  if (theme) {
    theme.dispose();
  }

  if (navigation) {
    navigation.dispose();
  }

  if (builder) {
    builder.dispose();
  }

  // 2. Remove map instance (after all controllers are cleaned up)
  if (map) {
    map.remove();
  }

  // 3. Remove PMTiles protocol
  if (protocol) {
    maplibreGL.removeProtocol('pmtiles');
  }

  IS_DEBUG && lifecycleLogger.log('Cleanup complete');
}

/**
 * Resolve target coordinates from route params
 *
 * @param {Object} route - Route object from router
 * @returns {Array|null} - [lon, lat] or null
 */
export function resolveTargetCoords(route) {
  const params = route?.result?.querystring?.params;
  if (!params) return null;

  const lon = parseFloat(params.lon);
  const lat = parseFloat(params.lat);

  if (Number.isNaN(lon) || Number.isNaN(lat)) return null;

  return [lon, lat];
}
