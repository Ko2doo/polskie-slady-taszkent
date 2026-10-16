/**
 * Test-only recorders of the MapLibre pieces the map-screen modules use (see harness/testing.md:
 * heavy UI glue around MapLibre is tested at the logic level with recorder mocks of the engine).
 *
 * Usage, inside a test file:
 *   vi.mock('maplibre-gl', async () => (await import('@/test/mapRecorders')).maplibreRecorder);
 *   import { createdMarkers } from '@/test/mapRecorders';
 */
import { vi } from 'vitest';

// Every Marker created through the mocked maplibre-gl, in order (reset it in beforeEach)
export const createdMarkers = [];

class MarkerRecorder {
  constructor(options) {
    this.options = options;
    this.lngLat = null;
    this.map = null;
    this.removed = false;
    this.setLngLat = vi.fn((lngLat) => {
      this.lngLat = lngLat;
      return this;
    });
    this.addTo = vi.fn((map) => {
      this.map = map;
      return this;
    });
    this.remove = vi.fn(() => {
      this.removed = true;
      return this;
    });
    createdMarkers.push(this);
  }
}

class LngLatBoundsRecorder {
  constructor(southWest, northEast) {
    this.points = [southWest, northEast];
  }

  extend(point) {
    this.points.push(point);
    return this;
  }
}

// Every Popup opened through the mocked maplibre-gl, in order (reset it in beforeEach)
export const openedPopups = [];

class PopupRecorder {
  constructor(options) {
    this.options = options;
    this.setLngLat = vi.fn((lngLat) => {
      this.lngLat = lngLat;
      return this;
    });
    this.setDOMContent = vi.fn((element) => {
      this.element = element;
      return this;
    });
    this.addTo = vi.fn((map) => {
      this.map = map;
      openedPopups.push(this);
      return this;
    });
  }
}

export const maplibreRecorder = { Marker: MarkerRecorder, LngLatBounds: LngLatBoundsRecorder, Popup: PopupRecorder };

/** The map methods the navigation controllers call */
export function createMapRecorder() {
  return { flyTo: vi.fn(), fitBounds: vi.fn() };
}

/** The builder methods the navigation controllers call */
export function createBuilderRecorder() {
  return { addNavigationRoute: vi.fn(), clearNavigationRoute: vi.fn() };
}

/** Markers still on the map */
export function markersOnMap() {
  return createdMarkers.filter((marker) => marker.map && !marker.removed);
}

/** A successful findRoute() result between two [lon, lat] points */
export function routeResult(from, to, distance = 100) {
  return {
    success: true,
    route: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [from, to] },
      properties: { distance, nodes: 2, computeTime: 1, iterations: 3 },
    },
  };
}

/**
 * A recorder of the MapLibre style API the builders use: sources, layers, images, layer click
 * handlers, projection. `clickLayer(layerId, event)` plays the user tapping a feature of a layer.
 * `project([lon, lat])` is a plain linear projection (1° = 1000 px), enough to test distances.
 */
export function createStyleMapRecorder() {
  const sources = new Map();
  const layers = new Map();
  const images = new Map();
  const clickHandlers = [];

  return {
    sources,
    layers,
    images,
    clickHandlers,
    addSource: vi.fn((id, definition) => {
      const source = { ...definition, setData: vi.fn((data) => (source.data = data)) };
      sources.set(id, source);
    }),
    getSource: (id) => sources.get(id),
    removeSource: vi.fn((id) => sources.delete(id)),
    addLayer: vi.fn((layer) => layers.set(layer.id, structuredClone(layer))),
    getLayer: (id) => layers.get(id),
    removeLayer: vi.fn((id) => layers.delete(id)),
    hasImage: (id) => images.has(id),
    addImage: vi.fn((id, image) => images.set(id, image)),
    setLayoutProperty: vi.fn((id, property, value) => {
      layers.get(id).layout[property] = value;
    }),
    on: vi.fn((event, layerId, handler) => clickHandlers.push({ event, layerId, handler })),
    off: vi.fn((event, layerId, handler) => {
      const index = clickHandlers.findIndex(
        (item) => item.event === event && item.layerId === layerId && item.handler === handler,
      );
      if (index !== -1) clickHandlers.splice(index, 1);
    }),
    project: ([lon, lat]) => ({ x: lon * 1000, y: lat * 1000 }),
    queryRenderedFeatures: vi.fn(() => []),
    clickLayer(layerId, event) {
      clickHandlers.filter((item) => item.layerId === layerId).forEach((item) => item.handler(event));
    },
    /** A style change (theme switch): everything added to the style is gone */
    resetStyle() {
      sources.clear();
      layers.clear();
      images.clear();
    },
  };
}

/**
 * jsdom never loads images. Replace the global Image with one that "loads" right after `src` is
 * set, or fails if the url contains "broken". Returns the list of created images.
 * Call inside a test (or beforeEach): vi.stubGlobal is undone after every test.
 */
export function stubImageLoading() {
  const created = [];

  class LoadingImage {
    constructor() {
      created.push(this);
    }

    set src(url) {
      this._src = url;
      if (!url) return;
      queueMicrotask(() => (url.includes('broken') ? this.onerror?.(new Error('404')) : this.onload?.()));
    }

    get src() {
      return this._src;
    }
  }

  vi.stubGlobal('Image', LoadingImage);
  return created;
}

/** Let queued image loads (and the promises waiting on them) run */
export const flushImageLoads = () => new Promise((resolve) => setTimeout(resolve, 0));
