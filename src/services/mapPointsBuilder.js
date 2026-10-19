/**
 * MapPointsBuilder
 *
 * Purpose:
 *   Encapsulates all logic for rendering point-based data (markers) and optional
 *   city boundaries on a MapLibre map. It:
 *     - Builds a GeoJSON FeatureCollection from domain data (features)
 *     - Adds sources for points and boundaries
 *     - Creates symbol layers for icons and labels
 *     - Attaches click handlers and renders custom HTML popups
 *     - Integrates with SPA routing via callback (popupTrigger)
 *     - Lets the app switch popups off (popup guard), e.g. while a navigation mode is active
 *     - Manages navigation routes (add/clear)
 *     - Shows or hides all markers (the markers filter), the state survives a theme change
 *     - Tells whether a screen position is close to a marker (also while the markers are hidden)
 *
 * Requirements:
 *   - `currentMap` must be an initialized MapLibre map instance
 *   - `data` is an array of objects where each item contains:
 *       - `id`     - unique identifier for the feature
 *       - `coords` - [lat, lon] in WGS84 (will be converted to [lon, lat] for GeoJSON)
 *   - `i18n` provides translation functions:
 *       - `i18n.title(item)`        -> string shown as marker/label title
 *       - `i18n.popupLink()`        -> string shown as popup link text
 *
 * Typical usage (inside a Map.svelte component):
 *
 *   const builder = MapPointsBuilder.create()
 *     .withMap(map)
 *     .withData(articlesMeta)
 *     .withStyleVersion(styleVersion)
 *     .withI18n({
 *       title: (item) => i18n.t(`articles:${item.id}:title`),
 *       popupLink: () => i18n.t('ui:buttons:readMore'),
 *     })
 *     .withPopup((id) => articlePopupState.open(id))
 *     .withPopupGuard(() => !isEditing)
 *     .withMarkers({
 *       icon: { name: 'article', url: '/map/icons/pointIcon.png' },
 *       // ... other marker config
 *     })
 *     .withCityBoundaries({
 *       render: true,
 *       // ... boundary config
 *     })
 *     .build();
 *
 *   // Then call:
 *   builder.addCityBoundaryLayer();
 *   builder.addMarkers();
 *
 * @class MapPointsBuilder
 */

import * as maplibreGL from 'maplibre-gl';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';
import { getLayerVisibility, setLayersVisibility } from '@/utils/mapLayerVisibility';
import { createPopupHTML } from './mapPopupHtml';

const pointsBuilderLogger = createLogger('MapPointsBuilder');

/**
 * Renders historical places (and the city boundary) on a MapLibre map — purpose, lifecycle and
 * the full builder-chain example are in the module header above.
 */
export class MapPointsBuilder {
  /**
   * Private constructor - use MapPointsBuilder.create() instead
   * @private
   */
  constructor() {
    // Configuration state
    this._config = {
      data: [],
      i18n: {
        title: null,
        popupLink: null,
      },
      styleVersion: 0,
      popupTrigger: () => {},
      isPopupEnabled: () => true,
      currentMap: null,
      markers: {
        render: false,
        icon: {
          name: 'default',
          url: '',
        },
        mapSource: [],
        mapLayer: [],
        listener: {
          iconLayerId: null,
          labelLayerId: null,
        },
      },
      cityBoundaries: {
        render: false,
        mapSource: [],
        mapLayer: [],
      },
    };

    // Internal state
    this._onMarkerClick = null;
    this._clickLayerId = null;
    this._iconImage = null;
    this._isMarkersVisible = true;
    this._isBuilt = false;
  }

  // ========================================
  // BUILDER PATTERN METHODS
  // ========================================

  /**
   * Create a new builder instance
   * @returns {MapPointsBuilder}
   */
  static create() {
    return new MapPointsBuilder();
  }

  /**
   * Set the data array (features to display)
   * @param {Array} data - Array of feature objects with {id, coords, ...}
   * @returns {MapPointsBuilder}
   */
  withData(data) {
    this._config.data = Array.isArray(data) ? data : [];
    return this;
  }

  /**
   * Set the i18n translation functions
   * @param {Object} i18n - Object with translation functions
   * @param {Function} i18n.title - Function to get feature title
   * @param {Function} i18n.popupLink - Function to get popup link text
   * @returns {MapPointsBuilder}
   */
  withI18n(i18n) {
    if (i18n && typeof i18n === 'object') {
      this._config.i18n = { ...this._config.i18n, ...i18n };
    }
    return this;
  }

  /**
   * Set the MapLibre map instance
   * @param {maplibreGL.Map} map - Initialized MapLibre map
   * @returns {MapPointsBuilder}
   */
  withMap(map) {
    this._config.currentMap = map;
    return this;
  }

  /**
   * Set the popup function for Popup state
   * @param {Function} popupTrigger - Function called with article ID on marker click
   * @returns {MapPointsBuilder}
   */
  withPopup(popupTrigger) {
    if (typeof popupTrigger === 'function') {
      this._config.popupTrigger = popupTrigger;
    }
    return this;
  }

  /**
   * Set the function that decides whether a marker click should open a popup
   * (for example, popups must be disabled while a navigation mode is active)
   * @param {Function} isPopupEnabled - Function returning true if the popup may be shown
   * @returns {MapPointsBuilder}
   */
  withPopupGuard(isPopupEnabled) {
    if (typeof isPopupEnabled === 'function') {
      this._config.isPopupEnabled = isPopupEnabled;
    }
    return this;
  }

  /**
   * Set the style version (for theme changes)
   * @param {number} version - Current style version
   * @returns {MapPointsBuilder}
   */
  withStyleVersion(version) {
    this._config.styleVersion = version;
    return this;
  }

  /**
   * Configure markers
   * @param {Object} config - Marker configuration
   * @returns {MapPointsBuilder}
   */
  withMarkers(config) {
    if (config && typeof config === 'object') {
      this._config.markers = { ...this._config.markers, ...config };
    }
    return this;
  }

  /**
   * Configure city boundaries
   * @param {Object} config - Boundary configuration
   * @returns {MapPointsBuilder}
   */
  withCityBoundaries(config) {
    if (config && typeof config === 'object') {
      this._config.cityBoundaries = { ...this._config.cityBoundaries, ...config };
    }
    return this;
  }

  /**
   * Finalize and validate configuration
   * @returns {MapPointsBuilder}
   * @throws {Error} If required configuration is missing
   */
  build() {
    if (!this._config.currentMap) {
      throw new Error('[MapPointsBuilder] Map instance is required. Use withMap() method.');
    }

    this._isBuilt = true;
    return this;
  }

  // ========================================
  // PUBLIC API METHODS
  // ========================================

  /**
   * Update style version (called on theme changes)
   * @param {number} version - New style version
   */
  setStyleVersion(version) {
    this._config.styleVersion = version;
  }

  /**
   * Clean up all resources and event listeners
   */
  dispose() {
    const map = this._config.currentMap;
    if (!map) return;

    // Remove click listeners
    if (this._onMarkerClick && this._clickLayerId) {
      if (Array.isArray(this._clickLayerId)) {
        this._clickLayerId.forEach((layerId) => {
          map.off('click', layerId, this._onMarkerClick);
        });
      } else {
        map.off('click', this._clickLayerId, this._onMarkerClick);
      }
    }

    // Clean up image references to prevent memory leaks
    if (this._iconImage) {
      this._iconImage.onload = null;
      this._iconImage.onerror = null;
      this._iconImage.src = '';
      this._iconImage = null;
    }

    this._onMarkerClick = null;
    this._clickLayerId = null;

    IS_DEBUG && pointsBuilderLogger.log('Disposed');
  }

  /**
   * Add city boundary layer to the map
   */
  addCityBoundaryLayer() {
    if (!this._config.cityBoundaries.render) return;

    const map = this._config.currentMap;
    if (!map) {
      IS_DEBUG && pointsBuilderLogger.warn('Cannot add boundaries: map not available');
      return;
    }

    const sources = this._config.cityBoundaries.mapSource;
    const layers = this._config.cityBoundaries.mapLayer;

    // Add sources
    sources.forEach((source) => {
      if (!source?.boundaryName) {
        IS_DEBUG && pointsBuilderLogger.warn('Boundary source missing name, skipping');
        return;
      }

      if (map.getSource(source.boundaryName)) {
        IS_DEBUG && pointsBuilderLogger.log(`Source "${source.boundaryName}" already exists, skipping`);
        return;
      }

      map.addSource(source.boundaryName, {
        type: source.type,
        data: source.data,
      });
    });

    // Add layers
    layers.forEach((layer) => {
      if (!layer?.id) {
        IS_DEBUG && pointsBuilderLogger.warn('Boundary layer missing id, skipping');
        return;
      }

      if (map.getLayer(layer.id)) {
        IS_DEBUG && pointsBuilderLogger.log(`Layer "${layer.id}" already exists, skipping`);
        return;
      }

      map.addLayer({
        id: layer.id,
        type: 'line',
        source: layer.source,
        paint: {
          'line-color': layer.lineColor,
          'line-width': layer.lineWidth,
        },
      });
    });

    IS_DEBUG && pointsBuilderLogger.log('City boundaries added');
  }

  /**
   * Add markers (icons, labels) and popup interactions to the map
   */
  addMarkers() {
    if (!this._config.markers.render) return;

    const map = this._config.currentMap;
    if (!map) {
      IS_DEBUG && pointsBuilderLogger.warn('Cannot add markers: map not available');
      return;
    }

    const iconName = this._config.markers.icon.name;
    const iconUrl = this._config.markers.icon.url;

    if (!iconUrl) {
      IS_DEBUG && pointsBuilderLogger.error('Icon URL is required for markers');
      return;
    }

    const clickLayerIds = [
      this._config.markers.listener.iconLayerId,
      this._config.markers.listener.labelLayerId,
    ].filter(Boolean);

    if (clickLayerIds.length === 0) {
      IS_DEBUG && pointsBuilderLogger.warn('No click layer IDs configured, popup will not work');
    }

    // Clean up previous listener if it exists
    if (this._onMarkerClick && this._clickLayerId) {
      if (Array.isArray(this._clickLayerId)) {
        this._clickLayerId.forEach((layerId) => {
          map.off('click', layerId, this._onMarkerClick);
        });
      }
      this._onMarkerClick = null;
      this._clickLayerId = null;
    }

    const myVersion = this._config.styleVersion;

    // Load icon image
    this._iconImage = new Image();
    this._iconImage.crossOrigin = 'anonymous';

    this._iconImage.onload = () => {
      // Check if style version changed (theme switched during loading)
      if (this._config.styleVersion !== myVersion) {
        IS_DEBUG && pointsBuilderLogger.log('Style version changed, aborting marker setup');
        return;
      }

      // Register icon image
      const imageId = `${iconName}-point`;
      if (!map.hasImage(imageId)) {
        map.addImage(imageId, this._iconImage);
        IS_DEBUG && pointsBuilderLogger.log(`Icon "${imageId}" registered`);
      }

      // Build GeoJSON from data
      const sourceData = this._buildDataFeatureCollection();

      // Add sources
      this._config.markers.mapSource.forEach((source) => {
        if (!source?.pointSourceName) {
          IS_DEBUG && pointsBuilderLogger.warn('Marker source missing name, skipping');
          return;
        }

        if (map.getSource(source.pointSourceName)) {
          IS_DEBUG && pointsBuilderLogger.log(`Source "${source.pointSourceName}" already exists, skipping`);
          return;
        }

        map.addSource(source.pointSourceName, {
          type: source.type,
          data: sourceData,
        });
      });

      // Add layers
      this._config.markers.mapLayer.forEach((layer) => {
        if (!layer?.id) {
          IS_DEBUG && pointsBuilderLogger.warn('Marker layer missing id, skipping');
          return;
        }

        if (map.getLayer(layer.id)) {
          IS_DEBUG && pointsBuilderLogger.log(`Layer "${layer.id}" already exists, skipping`);
          return;
        }

        map.addLayer({
          ...layer,
          layout: { ...layer.layout, visibility: getLayerVisibility(this._isMarkersVisible) },
        });
      });

      // Attach click handler for popups
      if (clickLayerIds.length > 0) {
        this._onMarkerClick = (e) => this._handleMarkerClick(e);
        this._clickLayerId = clickLayerIds;

        clickLayerIds.forEach((layerId) => {
          map.on('click', layerId, this._onMarkerClick);
        });

        IS_DEBUG && pointsBuilderLogger.log('Click handlers attached');
      }

      IS_DEBUG && pointsBuilderLogger.log('Markers added successfully');
    };

    this._iconImage.onerror = (error) => {
      if (this._config.styleVersion !== myVersion) return;

      IS_DEBUG && pointsBuilderLogger.error('Failed to load icon image:', error);
    };

    // Trigger image loading
    this._iconImage.src = iconUrl;
  }

  /**
   * Show or hide article markers (icons and labels).
   * The value is kept and applied to the layers that are (re)added later, e.g. after a theme change.
   * @param {boolean} isVisible - true to show, false to hide
   */
  setMarkersVisible(isVisible) {
    this._isMarkersVisible = isVisible;

    const map = this._config.currentMap;
    if (!map) return;

    const layerIds = this._config.markers.mapLayer.map((layer) => layer.id);
    setLayersVisibility(map, layerIds, isVisible);

    IS_DEBUG && pointsBuilderLogger.log(`Markers visibility set to ${isVisible}`);
  }

  /**
   * Check whether a screen position is close to any marker.
   * Works from the data and the map projection, so it also works while the markers are hidden
   * (a hidden layer has no rendered features to query).
   * @param {Object} screenPoint - { x, y } position in pixels, e.g. `e.point` of a MapLibre event
   * @param {number} radius - Max distance to a marker in pixels (inclusive)
   * @returns {boolean} - true if there is a marker within the radius
   */
  isMarkerNear(screenPoint, radius) {
    const map = this._config.currentMap;
    if (!map) return false;

    return this._config.data.some((item) => {
      const coordinates = this._transformCoords(item.coords);
      if (!coordinates) return false;

      const projected = map.project(coordinates);

      return Math.hypot(projected.x - screenPoint.x, projected.y - screenPoint.y) <= radius;
    });
  }

  /**
   * Add navigation route to the map
   * @param {Object} routeGeoJSON - GeoJSON feature with LineString geometry
   */
  addNavigationRoute(routeGeoJSON) {
    const map = this._config.currentMap;
    if (!map) {
      IS_DEBUG && pointsBuilderLogger.warn('Cannot add route: map not available');
      return;
    }

    // Validate GeoJSON
    if (!routeGeoJSON || !routeGeoJSON.geometry) {
      IS_DEBUG && pointsBuilderLogger.error('Invalid route GeoJSON: missing geometry');
      return;
    }

    const { type, coordinates } = routeGeoJSON.geometry;

    if (type !== 'LineString') {
      IS_DEBUG && pointsBuilderLogger.error(`Invalid geometry type: expected "LineString", got "${type}"`);
      return;
    }

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      IS_DEBUG && pointsBuilderLogger.error('Invalid LineString: must have at least 2 coordinates');
      return;
    }

    // Remove existing route
    this.clearNavigationRoute();

    // Add new route
    map.addSource('navigation-route', {
      type: 'geojson',
      data: routeGeoJSON,
    });

    map.addLayer({
      id: 'navigation-route',
      type: 'line',
      source: 'navigation-route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': '#007AFF', // iOS blue
        'line-width': 4,
        'line-opacity': 0.8,
      },
    });

    IS_DEBUG && pointsBuilderLogger.log('Navigation route added');
  }

  /**
   * Clear navigation route from the map
   */
  clearNavigationRoute() {
    const map = this._config.currentMap;
    if (!map) return;

    // Check if map is still valid (not removed)
    // MapLibre doesn't expose a direct "isRemoved" property,
    // so we use try-catch to handle the case when map is already destroyed
    try {
      if (map.getLayer('navigation-route')) {
        map.removeLayer('navigation-route');
      }

      if (map.getSource('navigation-route')) {
        map.removeSource('navigation-route');
      }

      IS_DEBUG && pointsBuilderLogger.log('Navigation route cleared');
    } catch {
      // Map is already removed/destroyed, which is fine during cleanup
      IS_DEBUG && pointsBuilderLogger.log('Map already removed, skipping route cleanup');
    }
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Transform coordinates from [lat, lon] to [lon, lat] for GeoJSON
   * @private
   * @param {Array} coords - [lat, lon] array
   * @returns {Array|null} - [lon, lat] array or null if invalid
   */
  _transformCoords(coords) {
    if (!Array.isArray(coords) || coords.length !== 2) {
      return null;
    }

    const [lat, lon] = coords;

    if (typeof lon !== 'number' || typeof lat !== 'number' || Number.isNaN(lon) || Number.isNaN(lat)) {
      return null;
    }

    return [lon, lat];
  }

  /**
   * Build GeoJSON FeatureCollection from data
   * @private
   * @returns {Object} - GeoJSON FeatureCollection
   */
  _buildDataFeatureCollection() {
    const features = this._config.data
      .map((item) => {
        const coords = item.coords;
        if (!coords || coords.length !== 2) {
          IS_DEBUG && pointsBuilderLogger.warn(`Invalid coords for item "${item.id}"`);
          return null;
        }

        const coordinates = this._transformCoords(coords);
        if (!coordinates) {
          IS_DEBUG && pointsBuilderLogger.warn(`Failed to transform coords for item "${item.id}"`);
          return null;
        }

        const titleFn = this._config.i18n.title;
        const title = typeof titleFn === 'function' ? titleFn(item) : '';

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates,
          },
          properties: {
            id: item.id,
            title: title,
            preview: item.photos[0] || '', // Popup location previews
          },
        };
      })
      .filter(Boolean);

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  /**
   * Create popup HTML content
   * @private
   * @param {string} title - Feature title
   * @param {string} id - Feature ID
   * @param {string} preview - Preview image URL
   * @returns {string} - HTML string
   */
  _createPopupHTML(title, id, preview) {
    return createPopupHTML({ title, id, preview, popupLinkFn: this._config.i18n.popupLink });
  }

  /**
   * Handle marker click event
   * @private
   * @param {Object} e - MapLibre click event
   */
  _handleMarkerClick(e) {
    // Popups are disabled, for example while a navigation mode is active
    if (!this._config.isPopupEnabled()) return;

    if (!e?.features?.length) return;

    const feature = e.features[0];
    const coords = feature.geometry.coordinates;
    const { id, title, preview } = feature.properties;

    // Create popup
    const popup = new maplibreGL.Popup({
      closeButton: false,
      closeOnClick: true,
    }).setLngLat(coords);

    // Create popup container
    const container = document.createElement('div');
    container.className = 'map-popup';
    container.innerHTML = this._createPopupHTML(title, id, preview);

    const articlePopup = container.querySelector('button[data-article-id]');
    if (articlePopup) {
      articlePopup.addEventListener('click', (event) => {
        event.preventDefault();
        this._config.popupTrigger(id);
      });
    }

    // Show popup
    popup.setDOMContent(container).addTo(this._config.currentMap);
  }
}
