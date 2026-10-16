import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStyleMapRecorder, flushImageLoads, openedPopups, stubImageLoading } from '@/test/mapRecorders';
import { MapPointsBuilder } from '@/services/mapPointsBuilder';

vi.mock('maplibre-gl', async () => (await import('@/test/mapRecorders')).maplibreRecorder);

// articles.js stores [lat, lon]
const ARTICLES = [
  { id: 'l01', coords: [41.3, 69.24], photos: ['previews/l01.webp'] },
  { id: 'l02', coords: [41.31, 69.25], photos: [''] },
];

const MARKERS = {
  render: true,
  icon: { name: 'article', url: '/map/icons/pointIcon.png' },
  mapSource: [{ pointSourceName: 'articles-points-source', type: 'geojson' }],
  mapLayer: [
    { id: 'articles-points-layer', type: 'symbol', source: 'articles-points-source', layout: { 'icon-size': 1 } },
    { id: 'articles-labels-layer', type: 'symbol', source: 'articles-points-source', layout: {} },
  ],
  listener: { iconLayerId: 'articles-points-layer', labelLayerId: 'articles-labels-layer' },
};

const BOUNDARIES = {
  render: true,
  mapSource: [{ boundaryName: 'city', type: 'geojson', data: '/map/tashkent_boundaries.geojson' }],
  mapLayer: [{ id: 'city-line', source: 'city', lineColor: '#f00', lineWidth: 2 }],
};

let map;
let popupTrigger;
let isPopupEnabled;

function build(overrides = {}) {
  return MapPointsBuilder.create()
    .withMap(map)
    .withData(overrides.data ?? ARTICLES)
    .withI18n({ title: (item) => `title:${item.id}`, popupLink: () => 'Read' })
    .withPopup(popupTrigger)
    .withPopupGuard(isPopupEnabled)
    .withMarkers(overrides.markers ?? MARKERS)
    .withCityBoundaries(BOUNDARIES)
    .build();
}

// A tap on a marker: MapLibre hands over the features under the finger
const tapOn = (feature) => ({ features: [feature] });

beforeEach(() => {
  map = createStyleMapRecorder();
  popupTrigger = vi.fn();
  isPopupEnabled = vi.fn(() => true);
  openedPopups.length = 0;
  stubImageLoading();
});

describe('build', () => {
  it('requires a map', () => {
    expect(() => MapPointsBuilder.create().build()).toThrow('Map instance is required');
  });

  it('ignores invalid config values', () => {
    const builder = MapPointsBuilder.create().withMap(map).withData('nope').withPopup('nope').build();

    expect(builder._config.data).toEqual([]);
    expect(typeof builder._config.popupTrigger).toBe('function');
  });
});

describe('addCityBoundaryLayer', () => {
  it('adds the boundary source and a line layer once', () => {
    const builder = build();

    builder.addCityBoundaryLayer();
    builder.addCityBoundaryLayer();

    expect(map.addSource).toHaveBeenCalledTimes(1);
    expect(map.layers.get('city-line')).toMatchObject({
      type: 'line',
      source: 'city',
      paint: { 'line-color': '#f00', 'line-width': 2 },
    });
  });

  it('does nothing when switched off', () => {
    MapPointsBuilder.create().withMap(map).withCityBoundaries({ render: false }).build().addCityBoundaryLayer();

    expect(map.addSource).not.toHaveBeenCalled();
  });
});

describe('addMarkers', () => {
  it('registers the icon, adds the points ([lat, lon] → [lon, lat]) and the layers', async () => {
    build().addMarkers();
    await flushImageLoads();

    expect(map.images.has('article-point')).toBe(true);
    expect(map.sources.get('articles-points-source').data.features).toEqual([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [69.24, 41.3] },
        properties: { id: 'l01', title: 'title:l01', preview: 'previews/l01.webp' },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [69.25, 41.31] },
        properties: { id: 'l02', title: 'title:l02', preview: '' },
      },
    ]);
    expect([...map.layers.keys()]).toEqual(['articles-points-layer', 'articles-labels-layer']);
    expect(map.layers.get('articles-points-layer').layout).toEqual({ 'icon-size': 1, visibility: 'visible' });
  });

  it('skips items with invalid coordinates', async () => {
    const data = [...ARTICLES, { id: 'bad', coords: [41.3], photos: [] }, { id: 'nan', coords: [NaN, 1], photos: [] }];

    build({ data }).addMarkers();
    await flushImageLoads();

    expect(map.sources.get('articles-points-source').data.features.map((f) => f.properties.id)).toEqual(['l01', 'l02']);
  });

  it('nothing is added when the icon does not load', async () => {
    build({ markers: { ...MARKERS, icon: { name: 'article', url: '/broken.png' } } }).addMarkers();
    await flushImageLoads();

    expect(map.addSource).not.toHaveBeenCalled();
  });

  // The theme switched while the icon was loading: the new style gets its own addMarkers()
  it('an icon that loads after a style change is ignored', async () => {
    const builder = build();

    builder.addMarkers();
    builder.setStyleVersion(1);
    await flushImageLoads();

    expect(map.addSource).not.toHaveBeenCalled();
  });

  it('after a style change, adds everything again with one click handler per layer', async () => {
    const builder = build();
    builder.addMarkers();
    await flushImageLoads();

    map.resetStyle();
    builder.setStyleVersion(1);
    builder.addMarkers();
    await flushImageLoads();

    expect(map.sources.has('articles-points-source')).toBe(true);
    expect(map.clickHandlers.map((item) => item.layerId)).toEqual(['articles-points-layer', 'articles-labels-layer']);
  });

  it('keeps hidden markers hidden after a style change', async () => {
    const builder = build();
    builder.setMarkersVisible(false);

    builder.addMarkers();
    await flushImageLoads();

    expect(map.layers.get('articles-points-layer').layout.visibility).toBe('none');
  });
});

describe('setMarkersVisible', () => {
  it('hides and shows the marker layers', async () => {
    const builder = build();
    builder.addMarkers();
    await flushImageLoads();

    builder.setMarkersVisible(false);
    expect(map.layers.get('articles-labels-layer').layout.visibility).toBe('none');

    builder.setMarkersVisible(true);
    expect(map.layers.get('articles-labels-layer').layout.visibility).toBe('visible');
  });
});

describe('popup', () => {
  async function ready() {
    const builder = build();
    builder.addMarkers();
    await flushImageLoads();
    return builder;
  }

  const feature = {
    geometry: { coordinates: [69.24, 41.3] },
    properties: { id: 'l01', title: 'Kościół', preview: 'previews/l01.webp' },
  };

  it('a tap on a marker opens a popup at it, and "Read more" opens the article', async () => {
    await ready();

    map.clickLayer('articles-points-layer', tapOn(feature));

    expect(openedPopups).toHaveLength(1);
    expect(openedPopups[0].lngLat).toEqual([69.24, 41.3]);
    expect(openedPopups[0].element.textContent).toContain('Kościół');

    openedPopups[0].element.querySelector('button[data-article-id]').click();
    expect(popupTrigger).toHaveBeenCalledWith('l01');
  });

  it('the label layer opens it too', async () => {
    await ready();

    map.clickLayer('articles-labels-layer', tapOn(feature));

    expect(openedPopups).toHaveLength(1);
  });

  it('no popup while popups are switched off (e.g. a navigation mode)', async () => {
    await ready();
    isPopupEnabled.mockReturnValue(false);

    map.clickLayer('articles-points-layer', tapOn(feature));

    expect(openedPopups).toHaveLength(0);
  });

  it('a tap without features does nothing', async () => {
    await ready();

    map.clickLayer('articles-points-layer', { features: [] });

    expect(openedPopups).toHaveLength(0);
  });
});

describe('isMarkerNear', () => {
  it('tells whether a screen point is within the radius of a marker', () => {
    const builder = build();
    const marker = map.project([69.24, 41.3]);

    expect(builder.isMarkerNear({ x: marker.x + 3, y: marker.y + 4 }, 5)).toBe(true);
    expect(builder.isMarkerNear({ x: marker.x + 30, y: marker.y }, 5)).toBe(false);
  });

  // The map editor must not drop a new point on top of a hidden article marker either
  it('works while the markers are hidden', () => {
    const builder = build();
    builder.setMarkersVisible(false);
    const marker = map.project([69.25, 41.31]);

    expect(builder.isMarkerNear(marker, 1)).toBe(true);
  });
});

describe('navigation route', () => {
  const route = {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [
        [69.24, 41.3],
        [69.25, 41.31],
      ],
    },
  };

  it('draws the route as one line layer, replacing the previous one', () => {
    const builder = build();

    builder.addNavigationRoute(route);
    builder.addNavigationRoute(route);

    expect(map.sources.get('navigation-route').data).toEqual(route);
    expect(map.layers.get('navigation-route').type).toBe('line');
    expect(map.removeLayer).toHaveBeenCalledWith('navigation-route');
  });

  it.each([
    ['no geometry', {}],
    ['not a line', { geometry: { type: 'Point', coordinates: [1, 2] } }],
    ['a single point', { geometry: { type: 'LineString', coordinates: [[1, 2]] } }],
  ])('refuses an invalid route: %s', (_label, invalid) => {
    build().addNavigationRoute(invalid);

    expect(map.addSource).not.toHaveBeenCalled();
  });

  it('clearNavigationRoute removes it, and is safe on a destroyed map', () => {
    const builder = build();
    builder.addNavigationRoute(route);

    builder.clearNavigationRoute();
    expect(map.layers.has('navigation-route')).toBe(false);
    expect(map.sources.has('navigation-route')).toBe(false);

    map.getLayer = () => {
      throw new Error('map removed');
    };
    expect(() => builder.clearNavigationRoute()).not.toThrow();
  });
});

describe('dispose', () => {
  it('detaches the click handlers', async () => {
    const builder = build();
    builder.addMarkers();
    await flushImageLoads();

    builder.dispose();

    expect(map.clickHandlers).toHaveLength(0);
  });
});
