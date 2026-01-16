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

/**
 * Geographic bounds fro Tashkent city
 * Format: [[west, south], [east, north]]
 */
export const MAP_BOUNDS = [
  [69.1038931009432, 41.144224013212],
  [69.5436061519978, 41.4359965669526],
];

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
