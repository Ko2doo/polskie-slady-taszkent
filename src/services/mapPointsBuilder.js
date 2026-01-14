/**
 * MapPointsBuilder
 *
 * Purpose:
 *   Encapsulates all logic for rendering point-based data (markers) and optional
 *   city boundaries on a MapLibre map. It:
 *     - builds a GeoJSON FeatureCollection from your domain data (`features`)
 *     - adds one or more sources for points and boundaries
 *     - creates symbol layers for icons and labels
 *     - attaches click handlers and renders a custom HTML popup
 *     - integrates with your SPA routing via a callback (`routeFunc`)
 *
 * Requirements:
 *   - `currentMap` must be an initialized MapLibre map instance.
 *   - `features` is an array of objects where each item contains:
 *       - `id`  – unique identifier for the feature
 *       - `coords` – [lat, lon] in WGS84; the class will convert it to [lon, lat] for GeoJSON
 *   - i18n is passed as functions:
 *       - `i18n.title(item)`     -> string shown as marker/label title
 *       - `i18n.popupLink()`     -> string shown as popup link text
 *
 * Typical usage (inside a Map.svelte on load)
 *
 */

import maplibreGL from 'maplibre-gl';

export class MapPointsBuilder {
  constructor(params = {}) {
    /* prettier-ignore */
    // defaults values
    const {
      data = [],
      i18n = {},
      routeFunc = () => {},
      currentMap,
      markers = {},
      cityBoundaries = {},
    } = params;

    // private params inner class
    this._params = {
      data,
      i18n: {
        title: i18n.title,
        popupLink: i18n.popupLink,
        popupGetOtherMaps: i18n.popupGetOtherMaps,
      },
      routeFunc,
      currentMap,
      markers: {
        render: markers.render !== false, // true with default
        icon: {
          name: markers.icon.name ?? 'default',
          url: markers.icon.url ?? '',
        },
        mapSource: markers.mapSource ?? [],
        mapLayer: markers.mapLayer ?? [],
        listener: {
          iconLayerId: markers.listener.iconLayerId,
          labelLayerId: markers.listener.labelLayerId,
        },
      },
      cityBoundaries: {
        render: cityBoundaries.render === true,
        mapSource: cityBoundaries.mapSource ?? [],
        mapLayer: cityBoundaries.mapLayer ?? [],
      },
    };
  }

  // Methods:

  // Transform [lat, lon] (from data) to [lon, lat] (GeoJSON)
  _coordsTransform(coord) {
    const [lat, lon] = coord;
    const coordsTransform = [lon, lat];

    // types check
    if (typeof lon !== 'number' || typeof lat !== 'number' || Number.isNaN(lon) || Number.isNaN(lat)) {
      return null;
    }

    return coordsTransform;
  }

  /**
   *  Build GeoJson FeatureCollection for data markers
   */
  _buildDataFeatureCollection() {
    const features = this._params.data
      .map((item) => {
        const coords = item.coords;
        if (!coords || coords.length !== 2) return null;

        const coordinates = this._coordsTransform(coords);
        if (!coordinates) return null;

        const titleFn = this._params.i18n.title;
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
   * City boundaries (GeoJson outline)
   */
  addCityBoundaryLayer() {
    if (!this._params.cityBoundaries.render) return;

    const map = this._params.currentMap;
    if (!map) return;

    const src = this._params.cityBoundaries.mapSource;
    const layers = this._params.cityBoundaries.mapLayer;

    src.forEach((source) => {
      if (!source?.boundaryName) return;
      if (map.getSource(source.boundaryName)) return;

      map.addSource(source.boundaryName, {
        type: source.type,
        data: source.data,
      });
    });

    layers.forEach((layer) => {
      if (!layer?.id) return;
      if (map.getLayer(layer.id)) return;

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
  }

  /**
   * Markers: icon, points, labels, popup behaviour
   */
  addMarkers() {
    if (!this._params.markers.render) return;

    const map = this._params.currentMap;
    if (!map) return;

    const src = this._params.markers.mapSource;
    const layers = this._params.markers.mapLayer;

    // icons
    const iconName = this._params.markers.icon.name;
    const iconUrl = this._params.markers.icon.url;

    if (!iconUrl) {
      console.error('[MapPointsBuilder] iconUrl is required for markers');
      return;
    }

    // create image element
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      // Register icon once
      if (!map.hasImage(`${iconName}-point`)) map.addImage(`${iconName}-point`, img);

      // Build points
      const sourceData = this._buildDataFeatureCollection();

      // Source with data points
      src.forEach((source) => {
        if (!source?.pointSourceName) return;
        if (map.getSource(source.pointSourceName)) return;

        map.addSource(source.pointSourceName, {
          type: source.type,
          data: sourceData,
        });
      });

      // Layers
      layers.forEach((layer) => {
        if (!layer?.id) return;
        if (map.getLayer(layer.id)) return;

        map.addLayer({ ...layer });
      });

      // Popup on marker click
      const clickLayerId = [this._params.markers.listener.iconLayerId, this._params.markers.listener.labelLayerId];
      if (!clickLayerId) {
        console.warn('[MapPointsBuilder] iconLayerId is not provided, click handler will not be attached');
      } else {
        map.on('click', clickLayerId, (e) => {
          if (!e?.features?.length) return;

          const feature = e.features[0];
          const coords = feature.geometry.coordinates;
          const { id, title } = feature.properties;

          // Popup initial
          const popup = new maplibreGL.Popup({
            closeButton: false, // we use custom close btn
            closeOnClick: true,
          }).setLngLat(coords);

          // Create custom popup element
          const container = document.createElement('div');
          container.className = 'map-popup';

          const popupLinkFn = this._params.i18n.popupLink;
          const popupLinkText = typeof popupLinkFn === 'function' ? popupLinkFn() : '';
          const popupGetOtherMaps =
            typeof this._params.i18n.popupGetOtherMaps === 'function' ? this._params.i18n.popupGetOtherMaps() : '';

          const [lon, lat] = coords;
          const coordsTransform = [lat, lon];

          // Popup inner content
          container.innerHTML = `
            <div class="flex justify-end mb-1">
              <button
                type="button"
                class="map-popup-close cursor-pointer w-7 h-7 flex items-center justify-center rounded-full bg-white/80 dark:text-black text-xs font-bold shadow"
                aria-label="Close"
              >&times;</button>
            </div>
            <div class="flex flex-col text-sm">
              <p class="w-full text-gray-900 dark:text-gray-900 text-base font-medium sm:font-bold">${title}</p>
              <a class="w-full text-blue-500 dark:text-blue-500 text-base mt-4" href="/articles/${id}" data-article-id="${id}">
                ${popupLinkText}
              </a>
              <a class="w-full text-blue-500 dark:text-blue-500 text-base mt-1" target="_blank" href="https://www.google.com/maps/place/${coordsTransform}">
                ${popupGetOtherMaps}
              </a>
            </div>
          `;

          // Popup custom close btn handler
          const closeBtn = container.querySelector('.map-popup-close');
          if (closeBtn) {
            closeBtn.addEventListener('click', () => {
              popup.remove();
            });
          }

          // SPA routing link
          const link = container.querySelector('a');
          if (link) {
            link.addEventListener('click', (event) => {
              event.preventDefault();
              this._params.routeFunc(id);
              popup.remove();
            });
          }

          // Add popup with DOM and map
          popup.setDOMContent(container).addTo(map);
        });
      }
    };

    img.onerror = (e) => {
      console.error('Failed to load icon image:', e);
    };

    // Add icon
    img.src = iconUrl;
  }

  /**
   * Add navigation route layer
   */
  addNavigationRoute(routeGeoJSON) {
    const map = this._params.currentMap;
    if (!map) return;

    // Remove existing route if any
    if (map.getLayer('navigation-route')) {
      map.removeLayer('navigation-route');
    }
    if (map.getSource('navigation-route')) {
      map.removeSource('navigation-route');
    }

    // Add new route
    map.addSource('navigation-route', {
      type: 'geojson',
      data: routeGeoJSON,
    });

    map.addLayer({
      id: 'navigation-route',
      type: 'line',
      source: 'navigation-route',
      paint: {
        'line-color': '#007AFF', // iOS blue
        'line-width': 4,
        'line-opacity': 0.8,
      },
    });
  }

  /**
   * Clear navigation route
   */
  clearNavigationRoute() {
    const map = this._params.currentMap;
    if (!map) return;

    if (map.getLayer('navigation-route')) {
      map.removeLayer('navigation-route');
    }
    if (map.getSource('navigation-route')) {
      map.removeSource('navigation-route');
    }
  }
}
