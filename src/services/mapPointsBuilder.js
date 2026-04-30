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
 *     - Manages navigation routes (add/clear)
 *
 * Requirements:
 *   - `currentMap` must be an initialized MapLibre map instance
 *   - `data` is an array of objects where each item contains:
 *       - `id`     - unique identifier for the feature
 *       - `coords` - [lat, lon] in WGS84 (will be converted to [lon, lat] for GeoJSON)
 *   - `i18n` provides translation functions:
 *       - `i18n.title(item)`        -> string shown as marker/label title
 *       - `i18n.popupLink()`        -> string shown as popup link text
 *       - `i18n.popupGetOtherMaps()` -> string for external maps link
 *
 * Typical usage (inside a Map.svelte component):
 *
 *   const builder = MapPointsBuilder.create()
 *     .withMap(map)
 *     .withData(articlesMeta)
 *     .withI18n({
 *       title: (item) => i18n.t(`articles:${item.id}:title`),
 *       popupLink: () => i18n.t('ui:buttons:readMore'),
 *       popupGetOtherMaps: () => i18n.t('ui:buttons:popupGetOtherMaps'),
 *     })
 *     .withRouter((id) => goto(`/articles/${id}`))
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

import maplibreGL from 'maplibre-gl';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const pointsBuilderLogger = createLogger('MapPointsBuilder');

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
        popupGetOtherMaps: null,
      },
      styleVersion: 0,
      popupTrigger: () => {},
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
   * @param {Function} i18n.popupGetOtherMaps - Function to get external map link text
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

        map.addLayer({ ...layer });
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
    } catch (error) {
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
            preview: item.assets?.preview || '', // Popup location previews
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
   * HTML escape helper to prevent XSS
   * @private
   * @param {string} text - Text to escape
   * @returns {string} - Escaped HTML
   */
  _escapeHtml(text) {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Create popup HTML content
   * @private
   * @param {string} title - Feature title
   * @param {string} id - Feature ID
   * @param {Array} coords - [lon, lat] coordinates
   * @returns {string} - HTML string
   */
  _createPopupHTML(title, id, coords, preview) {
    const popupLinkFn = this._config.i18n.popupLink;
    const popupGetOtherMapsFn = this._config.i18n.popupGetOtherMaps;

    const popupLinkText = typeof popupLinkFn === 'function' ? popupLinkFn() : 'Read more';
    const popupGetOtherMaps = typeof popupGetOtherMapsFn === 'function' ? popupGetOtherMapsFn() : 'Open in Google Maps';

    const [lon, lat] = coords;
    const googleMapsCoords = [lat, lon]; // Google Maps uses lat,lon

    const previewHTML = preview
      ? `<img
          src="${this._escapeHtml(preview)}"
          alt="${this._escapeHtml(title)}"
          class="map-popup-title w-full h-40 object-bottom object-top rounded-t-3xl"
          loading="lazy">`
      : '';

    return `
      <div class="map-popup-content flex flex-col">
        ${previewHTML}

        <div class="map-content-wrapper flex flex-col gap-2">
          <p class="map-popup-title w-full text-gray-900 dark:text-gray-200 mb-2 text-[15px] font-medium sm:font-bold">
            ${this._escapeHtml(title)}
          </p>

          <button
            class="map-popup-title w-full text-left text-blue-400 dark:text-blue-400 text-[14px]"
            data-article-id="${this._escapeHtml(id)}">

            ${this._escapeHtml(popupLinkText)}
          </button>
          <a 
            class="map-popup-title w-full text-blue-400 dark:text-blue-400 text-[14px]"
            target="_blank" 
            rel="noopener noreferrer"
            href="https://www.google.com/maps/place/${googleMapsCoords.join(',')}">

            ${this._escapeHtml(popupGetOtherMaps)}
          </a>
        </div>
      </div>
    `.trim();
  }

  /**
   * Handle marker click event
   * @private
   * @param {Object} e - MapLibre click event
   */
  _handleMarkerClick(e) {
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
    container.innerHTML = this._createPopupHTML(title, id, coords, preview);

    // Attach close button handler
    const closeBtn = container.querySelector('.map-popup-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        popup.remove();
      });
    }

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
