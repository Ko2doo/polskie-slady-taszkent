import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStyleMapRecorder, openedPopups, stubImageLoading } from '@/test/mapRecorders';
import { CustomPointsBuilder } from '@/services/customPointsBuilder';

vi.mock('maplibre-gl', async () => (await import('@/test/mapRecorders')).maplibreRecorder);

const MARKERS = {
  sourceName: 'custom-points-source',
  defaultIconName: 'default',
  icons: [
    { name: 'default', url: '/map/icons/gpsIcon.png' },
    { name: 'star', url: '/map/icons/star.png' },
  ],
  mapLayer: [
    { id: 'custom-points-layer', type: 'symbol', source: 'custom-points-source', layout: { 'icon-size': 0.38 } },
    { id: 'custom-points-labels', type: 'symbol', source: 'custom-points-source', layout: {} },
  ],
};

const POINT = { id: 'p1', coords: { lng: 69.24, lat: 41.3 }, title: '  Dom  ', preview: 'blob:cover' };

let map;
let popupTrigger;
let isPopupEnabled;

function build(markers = MARKERS) {
  return CustomPointsBuilder.create()
    .withMap(map)
    .withI18n({ popupLink: () => 'Read' })
    .withPopup(popupTrigger)
    .withPopupGuard(isPopupEnabled)
    .withMarkers(markers)
    .build();
}

async function ready() {
  const builder = build();
  await builder.init();
  return builder;
}

const features = () => map.sources.get('custom-points-source').data.features;

beforeEach(() => {
  map = createStyleMapRecorder();
  popupTrigger = vi.fn();
  isPopupEnabled = vi.fn(() => true);
  openedPopups.length = 0;
  stubImageLoading();
});

describe('build', () => {
  it('requires a map, a layer, icons and the default icon among them', () => {
    expect(() => CustomPointsBuilder.create().build()).toThrow('Map instance is required');
    expect(() => build({ ...MARKERS, mapLayer: [] })).toThrow('At least one layer');
    expect(() => build({ ...MARKERS, icons: [] })).toThrow('At least one icon');
    expect(() => build({ ...MARKERS, defaultIconName: 'missing' })).toThrow('Default icon "missing"');
  });
});

describe('init', () => {
  it('registers every icon, adds the source and the layers, listens to taps on both layers', async () => {
    await ready();

    expect([...map.images.keys()]).toEqual(['default-custom-point', 'star-custom-point']);
    expect(features()).toEqual([]);
    expect([...map.layers.keys()]).toEqual(['custom-points-layer', 'custom-points-labels']);
    expect(map.clickHandlers.map((item) => item.layerId)).toEqual(['custom-points-layer', 'custom-points-labels']);
  });

  it('a broken icon: nothing is added, not ready', async () => {
    const builder = build({ ...MARKERS, icons: [{ name: 'default', url: '/broken.png' }] });

    await builder.init();

    expect(map.addSource).not.toHaveBeenCalled();
    expect(builder.getPointIdAt({ x: 0, y: 0 })).toBeNull();
  });

  it('icons that load after a style change are ignored', async () => {
    const builder = build();

    const pending = builder.init();
    builder.setStyleVersion(1);
    await pending;

    expect(map.addSource).not.toHaveBeenCalled();
  });

  // A theme switch wipes the style: the points come back from the builder's memory
  it('restores the points and keeps one click handler per layer after a style change', async () => {
    const builder = await ready();
    builder.addPoint(POINT);

    map.resetStyle();
    builder.setStyleVersion(1);
    await builder.init();

    expect(features().map((feature) => feature.properties.id)).toEqual(['p1']);
    expect(map.clickHandlers).toHaveLength(2);
  });

  it('hidden points stay hidden after a style change', async () => {
    const builder = await ready();
    builder.setVisible(false);

    map.resetStyle();
    await builder.init();

    expect(map.layers.get('custom-points-layer').layout.visibility).toBe('none');
  });
});

describe('addPoint', () => {
  it('adds a point with a trimmed title and the default icon, and updates the map', async () => {
    const builder = await ready();

    const added = builder.addPoint(POINT);

    expect(added).toEqual({
      id: 'p1',
      coordinates: [69.24, 41.3],
      title: 'Dom',
      preview: 'blob:cover',
      iconName: 'default',
    });
    expect(features()).toEqual([
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [69.24, 41.3] },
        properties: { id: 'p1', title: 'Dom', preview: 'blob:cover', icon: 'default-custom-point' },
      },
    ]);
  });

  it('a known icon is kept, an unknown one falls back to the default', async () => {
    const builder = await ready();

    expect(builder.addPoint({ ...POINT, id: 'a', iconName: 'star' }).iconName).toBe('star');
    expect(builder.addPoint({ ...POINT, id: 'b', iconName: 'nope' }).iconName).toBe('default');
  });

  it.each([
    ['no id', { ...POINT, id: '' }],
    ['no coordinates', { ...POINT, coords: null }],
    ['NaN coordinates', { ...POINT, coords: { lng: NaN, lat: 1 } }],
    ['an empty title', { ...POINT, title: '   ' }],
    ['not an object', 'p1'],
  ])('refuses a point with %s', async (_label, point) => {
    const builder = await ready();

    expect(builder.addPoint(point)).toBeNull();
    expect(builder.getPoints()).toEqual([]);
  });

  it('refuses a duplicate id', async () => {
    const builder = await ready();
    builder.addPoint(POINT);

    expect(builder.addPoint({ ...POINT, title: 'Other' })).toBeNull();
    expect(builder.getPoints()).toHaveLength(1);
  });

  // The map's "load" (and init) can come after the saved points were added
  it('points added before init show up once it runs', async () => {
    const builder = build();
    builder.addPoint(POINT);

    await builder.init();

    expect(features()).toHaveLength(1);
  });

  it('returns copies: the caller cannot change the builder memory', async () => {
    const builder = await ready();
    builder.addPoint(POINT).title = 'changed';
    builder.getPoints()[0].title = 'changed';

    expect(builder.getPoints()[0].title).toBe('Dom');
  });
});

describe('updatePoint / removePoint / clearPoints', () => {
  it('updates the title and the preview, never the coordinates', async () => {
    const builder = await ready();
    builder.addPoint(POINT);

    const updated = builder.updatePoint({ id: 'p1', title: 'New', preview: 'blob:new', coords: { lng: 1, lat: 1 } });

    expect(updated).toMatchObject({ title: 'New', preview: 'blob:new', coordinates: [69.24, 41.3] });
    expect(features()[0].properties.title).toBe('New');
  });

  it('keeps the preview when none is given', async () => {
    const builder = await ready();
    builder.addPoint(POINT);

    expect(builder.updatePoint({ id: 'p1', title: 'New' }).preview).toBe('blob:cover');
  });

  it('refuses an unknown point or an empty title', async () => {
    const builder = await ready();
    builder.addPoint(POINT);

    expect(builder.updatePoint({ id: 'nope', title: 'X' })).toBeNull();
    expect(builder.updatePoint({ id: 'p1', title: ' ' })).toBeNull();
    expect(builder.getPoints()[0].title).toBe('Dom');
  });

  it('removes a point from the map', async () => {
    const builder = await ready();
    builder.addPoint(POINT);

    expect(builder.removePoint('p1')).toBe(true);
    expect(builder.removePoint('p1')).toBe(false);
    expect(features()).toEqual([]);
  });

  it('clearPoints empties the map', async () => {
    const builder = await ready();
    builder.addPoint(POINT);
    builder.addPoint({ ...POINT, id: 'p2' });

    builder.clearPoints();

    expect(features()).toEqual([]);
  });
});

describe('getPointIdAt', () => {
  it('returns the id of the point under the finger', async () => {
    const builder = await ready();
    map.queryRenderedFeatures.mockReturnValueOnce([{ properties: { id: 'p1' } }]);

    expect(builder.getPointIdAt({ x: 10, y: 20 })).toBe('p1');
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith(
      { x: 10, y: 20 },
      { layers: ['custom-points-layer', 'custom-points-labels'] },
    );
  });

  it('null when nothing is there', async () => {
    const builder = await ready();

    expect(builder.getPointIdAt({ x: 10, y: 20 })).toBeNull();
  });

  // Querying a layer missing from the style fires a MapLibre error event
  it('during a style change does not query layers that are gone', async () => {
    const builder = await ready();
    map.resetStyle();

    expect(builder.getPointIdAt({ x: 10, y: 20 })).toBeNull();
    expect(map.queryRenderedFeatures).not.toHaveBeenCalled();
  });
});

describe('popup', () => {
  const tap = {
    features: [{ geometry: { coordinates: [69.24, 41.3] }, properties: { id: 'p1', title: 'Dom', preview: '' } }],
  };

  it('a tap opens a popup, "Read more" opens the point', async () => {
    await ready();

    map.clickLayer('custom-points-layer', tap);
    openedPopups[0].element.querySelector('button[data-article-id]').click();

    expect(popupTrigger).toHaveBeenCalledWith('p1');
  });

  it('no popup while popups are off (the map editor mode)', async () => {
    await ready();
    isPopupEnabled.mockReturnValue(false);

    map.clickLayer('custom-points-labels', tap);

    expect(openedPopups).toHaveLength(0);
  });
});

describe('dispose', () => {
  it('detaches the taps and releases the icon images', async () => {
    const images = stubImageLoading();
    const builder = await ready();

    builder.dispose();

    expect(map.clickHandlers).toHaveLength(0);
    expect(images.every((image) => image.onload === null && image.src === '')).toBe(true);
    expect(builder.getPointIdAt({ x: 0, y: 0 })).toBeNull();
  });
});
