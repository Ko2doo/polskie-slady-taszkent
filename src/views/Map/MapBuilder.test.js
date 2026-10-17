import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStyleMapRecorder, flushImageLoads, stubImageLoading } from '@/test/mapRecorders';
import { CUSTOM_POINTS_CONFIG, MARKER_CONFIG } from '@/views/Map/MapConstants';
import { createCustomPointsBuilder, createMapPointsBuilder } from '@/views/Map/MapBuilder.svelte.js';

vi.mock('maplibre-gl', async () => (await import('@/test/mapRecorders')).maplibreRecorder);

// Translation keys come back as they are, so the test sees which key the builder asked for
const i18n = { t: (key) => key };

let map;

beforeEach(() => {
  map = createStyleMapRecorder();
  stubImageLoading();
});

describe('createMapPointsBuilder', () => {
  it('builds the article markers from the shared config, titled from the articles namespace', async () => {
    const builder = createMapPointsBuilder({
      map,
      data: [{ id: 'l05', coords: [41.3, 69.24], photos: [''] }],
      i18n,
      popupTrigger: vi.fn(),
      isPopupEnabled: () => true,
      styleVersion: 0,
    });

    builder.addMarkers();
    await flushImageLoads();

    const [source] = MARKER_CONFIG.customMarkers.mapSource;
    expect(map.sources.get(source.pointSourceName).data.features[0].properties.title).toBe('articles:l05:title');
  });
});

describe('createCustomPointsBuilder', () => {
  it('builds the custom points from the shared config', async () => {
    const builder = createCustomPointsBuilder({
      map,
      i18n,
      popupTrigger: vi.fn(),
      isPopupEnabled: () => true,
      styleVersion: 0,
    });

    await builder.init();

    expect(map.sources.has(CUSTOM_POINTS_CONFIG.sourceName)).toBe(true);
    expect([...map.layers.keys()]).toEqual(CUSTOM_POINTS_CONFIG.mapLayer.map((layer) => layer.id));
  });
});
