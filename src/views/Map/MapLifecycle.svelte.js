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

/**
 * Initialize PMTiles source
 *
 * @param {Object} i18n - i18n store for error messages
 * @returns {Promise<Protocol>} - PMTiles protocol instance
 */
export async function initializePMTiles(i18n) {
  console.log('[MapLifecycle] Loading PMTiles...');

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

    console.log('[MapLifecycle] PMTiles loaded successfully');
    return protocol;
  } catch (error) {
    console.error('[MapLifecycle] Failed to load PMTiles:', error);

    errorToast.error(i18n.t('ui:errors:mapPMTilesFetch'), {
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
  console.log('[MapLifecycle] Creating MapLibre instance...');

  const map = new maplibreGL.Map({
    container,
    style,
    ...INITIAL_VIEW,
  });

  console.log('[MapLifecycle] MapLibre instance created');
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
  console.log('[MapLifecycle] Setting up map handlers...');

  map.setMaxBounds(MAP_BOUNDS);
  console.log('[MapLifecycle] MaxBounds set:', MAP_BOUNDS);

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
    console.log('[MapLifecycle] Flying to target coordinates:', targetCoords);
  }

  console.log('[MapLifecycle] Map handlers ready');
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
  console.log('[MapLifecycle] Cleaning up map resources...');

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

  console.log('[MapLifecycle] Cleanup complete');
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
