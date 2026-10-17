import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as maplibreGL from 'maplibre-gl';
import { errorToast } from '@/store/ui/errorToast';
import { INITIAL_VIEW, MAP_BOUNDS, PMTILES_PATH } from '@/views/Map/MapConstants';
import {
  cleanupMap,
  initializeMap,
  initializePMTiles,
  resolveTargetCoords,
  setupMapHandlers,
} from '@/views/Map/MapLifecycle.svelte.js';

// MapLibre needs WebGL: the module-level API and the classes it uses are recorders
vi.mock('maplibre-gl', () => {
  class Map {
    constructor(options) {
      this.options = options;
      this.addControl = vi.fn();
    }
  }
  class AttributionControl {
    constructor(options) {
      this.options = options;
    }
  }
  return { Map, AttributionControl, setWorkerUrl: vi.fn(), addProtocol: vi.fn(), removeProtocol: vi.fn() };
});

vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn() } }));

const i18n = { t: (key) => key };

beforeEach(() => {
  maplibreGL.addProtocol.mockClear();
  maplibreGL.removeProtocol.mockClear();
  errorToast.error.mockClear();
});

describe('initializePMTiles', () => {
  it('loads the whole archive once and registers the pmtiles:// protocol', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) })),
    );

    const protocol = await initializePMTiles(i18n);

    expect(fetch).toHaveBeenCalledWith(PMTILES_PATH);
    expect(maplibreGL.addProtocol).toHaveBeenCalledWith('pmtiles', protocol.tile);
  });

  it('a failed download tells the user and rejects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 404, statusText: 'Not Found' })),
    );

    await expect(initializePMTiles(i18n)).rejects.toThrow('HTTP 404: Not Found');
    expect(errorToast.error).toHaveBeenCalledWith('errors:mapPMTilesFetch', expect.anything());
    expect(maplibreGL.addProtocol).not.toHaveBeenCalled();
  });
});

describe('initializeMap', () => {
  it('creates the map with the initial view and a compact attribution of the map data', () => {
    const container = document.createElement('div');

    const map = initializeMap({ container, style: { version: 8 } });

    expect(map.options).toEqual({ container, style: { version: 8 }, attributionControl: false, ...INITIAL_VIEW });
    const [control, position] = map.addControl.mock.lastCall;
    expect(position).toBe('top-left');
    expect(control.options.compact).toBe(true);
    expect(control.options.customAttribution).toContain('OpenStreetMap');
  });
});

describe('setupMapHandlers', () => {
  function overlays() {
    return {
      map: { setMaxBounds: vi.fn(), flyTo: vi.fn() },
      builder: { addCityBoundaryLayer: vi.fn(), addMarkers: vi.fn() },
      customPointsBuilder: { init: vi.fn() },
    };
  }

  it('limits the map to the city and adds every overlay', () => {
    const parts = overlays();

    setupMapHandlers(parts);

    expect(parts.map.setMaxBounds).toHaveBeenCalledWith(MAP_BOUNDS);
    expect(parts.builder.addCityBoundaryLayer).toHaveBeenCalled();
    expect(parts.builder.addMarkers).toHaveBeenCalled();
    expect(parts.customPointsBuilder.init).toHaveBeenCalled();
    expect(parts.map.flyTo).not.toHaveBeenCalled();
  });

  it('flies to the requested place', () => {
    const parts = overlays();

    setupMapHandlers({ ...parts, targetCoords: [69.24, 41.3] });

    expect(parts.map.flyTo).toHaveBeenCalledWith({ center: [69.24, 41.3], zoom: 16 });
  });
});

describe('cleanupMap', () => {
  // The controllers still need a live map to unsubscribe from it
  it('disposes every controller before removing the map, then the protocol', () => {
    const order = [];
    const part = (name) => ({ dispose: () => order.push(name) });

    cleanupMap({
      map: { remove: () => order.push('map') },
      protocol: {},
      builder: part('builder'),
      customPointsBuilder: part('customPointsBuilder'),
      navigation: part('navigation'),
      theme: part('theme'),
    });

    expect(order).toEqual(['theme', 'navigation', 'builder', 'customPointsBuilder', 'map']);
    expect(maplibreGL.removeProtocol).toHaveBeenCalledWith('pmtiles');
  });

  // A screen left while loading is cleaned up late, after the next screen registered its own
  it('keeps the protocol while another map screen still uses it', async () => {
    // A fresh module: the protocol count is module state, other tests here leave it non-zero
    vi.resetModules();
    const lifecycle = await import('@/views/Map/MapLifecycle.svelte.js');
    const freshMaplibre = await import('maplibre-gl');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) })),
    );
    const leftScreen = await lifecycle.initializePMTiles(i18n);
    const nextScreen = await lifecycle.initializePMTiles(i18n);

    lifecycle.cleanupMap({ protocol: leftScreen });
    expect(freshMaplibre.removeProtocol).not.toHaveBeenCalled();

    lifecycle.cleanupMap({ protocol: nextScreen });
    expect(freshMaplibre.removeProtocol).toHaveBeenCalledTimes(1);
  });

  it('tolerates parts that were never created (the map failed to start)', () => {
    expect(() => cleanupMap({})).not.toThrow();
    expect(maplibreGL.removeProtocol).not.toHaveBeenCalled();
  });
});

describe('resolveTargetCoords', () => {
  const route = (params) => ({ result: { querystring: { params } } });

  it('reads ?lon=&lat= of the route', () => {
    expect(resolveTargetCoords(route({ lon: '69.24', lat: '41.3' }))).toEqual([69.24, 41.3]);
  });

  it.each([
    ['no route', undefined],
    ['no params', { result: {} }],
    ['a missing lat', route({ lon: '69.24' })],
    ['not numbers', route({ lon: 'x', lat: 'y' })],
  ])('null for %s', (_label, value) => {
    expect(resolveTargetCoords(value)).toBeNull();
  });
});
