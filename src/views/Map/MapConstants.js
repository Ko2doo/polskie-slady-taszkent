/**
 * Map Configuration Constants
 *
 * All static configuration values for the map component:
 * - PMTiles paths and keys
 * - Marker configurations
 * - Map bounds and initial view
 * - Layer configurations
 */

// ========================================
// PMTILES CONFIGURATION
// ========================================

export const PMTILES_PATH = '/map/tashkent_20251124.pmtiles';
export const PMTILES_KEY = 'tashkent-local';
export const CITY_BOUNDARIES = '/map/tashkent_boundaries.geojson';

// ========================================
// MAP BOUNDS & INITIAL VIEW
// ========================================

// The area the offline map covers, shared with GPS tracking (defined in data/mapArea.js)
export { MAP_BOUNDS } from '@/data/mapArea';

/**
 * Initial map view configuration
 */
export const INITIAL_VIEW = {
  center: [69.29, 41.3],
  zoom: 11,
  minZoom: 10,
  maxZoom: 17,
};

// ========================================
// MARKER CONFIGURATIONS
// ========================================

/**
 * Marker configuration for different marker types
 */
export const MARKER_CONFIG = {
  // Custom markers from MapPointsBuilder
  customMarkers: {
    render: true,
    icon: {
      name: 'article',
      url: '/map/icons/pointIcon.png',
    },
    mapSource: [{ pointSourceName: 'articles-points-source', type: 'geojson' }],
    mapLayer: [
      {
        id: 'articles-points-layer',
        type: 'symbol',
        source: 'articles-points-source',
        layout: {
          'icon-image': 'article-point',
          'icon-size': 0.38,
          'icon-allow-overlap': true,
        },
      },
      {
        id: 'articles-labels-layer',
        type: 'symbol',
        source: 'articles-points-source',
        minzoom: 12.5,
        layout: {
          'text-field': ['get', 'title'],
          'text-size': 12,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'icon-optional': true,
        },
        paint: {
          'text-color': '#111111',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      },
    ],
    listener: {
      iconLayerId: 'articles-points-layer',
      labelLayerId: 'articles-labels-layer',
    },
  },

  // Offline navigation markers
  navigation: {
    start: {
      icon: '🟢',
      className: 'navigation-marker start-marker',
      label: 'Start',
    },
    end: {
      icon: '🔴',
      className: 'navigation-marker end-marker',
      label: 'End',
    },
  },
};

/**
 * Configuration for user-created points (CustomPointsBuilder)
 * Same layer structure as MARKER_CONFIG, the ids from mapLayer are also used for click handling.
 */
export const CUSTOM_POINTS_CONFIG = {
  sourceName: 'custom-points-source',
  defaultIconName: 'default',
  icons: [{ name: 'default', url: '/map/icons/gpsIcon.png' }],

  mapLayer: [
    {
      id: 'custom-points-layer',
      type: 'symbol',
      source: 'custom-points-source',
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': 0.38,
        'icon-allow-overlap': true,
      },
    },
    {
      id: 'custom-points-labels-layer',
      type: 'symbol',
      source: 'custom-points-source',
      minzoom: 12.5,
      layout: {
        'text-field': ['get', 'title'],
        'text-size': 12,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-allow-overlap': false,
        'icon-optional': true,
      },
      paint: {
        'text-color': '#111111',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    },
  ],
};

/**
 * Configuration for the map editor mode
 *
 * Article markers are hidden in this mode, so a new point is not allowed closer than `historicalMarkerGuardRadius`
 * (in screen pixels) to an article marker. It is about the size of the marker icon plus the finger inaccuracy.
 */
export const EDIT_MODE_CONFIG = {
  historicalMarkerGuardRadius: 40,
};

/**
 * CSS styles for navigation markers
 */
export const MARKER_STYLE = {
  fontSize: '24px',
};

// ========================================
// CITY BOUNDARY CONFIGURATION
// ========================================

/**
 * Configuration for city boundary rendering
 */
export const BOUNDARY_CONFIG = {
  render: true,
  mapSource: [
    {
      boundaryName: 'city-boundaries',
      type: 'geojson',
      data: CITY_BOUNDARIES,
    },
  ],
  mapLayer: [
    {
      id: 'city-boundary',
      source: 'city-boundaries',
      lineColor: '#f56f32',
      lineWidth: 6,
    },
  ],
};

// ========================================
// NAVIGATION ROUTE CONFIGURATION
// ========================================

/**
 * Padding for fitBounds when displaying route
 */
export const ROUTE_FIT_PADDING = {
  top: 100,
  bottom: 100,
  left: 100,
  right: 100,
};
