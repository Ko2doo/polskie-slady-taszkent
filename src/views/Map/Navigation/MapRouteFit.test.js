import { describe, it, expect, vi } from 'vitest';
import { createMapRecorder } from '@/test/mapRecorders';
import { ROUTE_FIT_PADDING } from '@/views/Map/MapConstants';
import { fitMapToRoute } from './MapRouteFit';

vi.mock('maplibre-gl', async () => (await import('@/test/mapRecorders')).maplibreRecorder);

const line = (coordinates) => ({ geometry: { coordinates } });

describe('fitMapToRoute', () => {
  it('fits the camera to every point of the route, with the route padding', () => {
    const map = createMapRecorder();
    const coordinates = [
      [69.24, 41.3],
      [69.3, 41.25],
      [69.26, 41.35],
    ];

    fitMapToRoute(map, line(coordinates));

    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    const [bounds, options] = map.fitBounds.mock.lastCall;
    expect(bounds.points).toEqual(expect.arrayContaining(coordinates));
    expect(options).toEqual({ padding: ROUTE_FIT_PADDING });
  });

  it('a one-point route fits to that point', () => {
    const map = createMapRecorder();

    fitMapToRoute(map, line([[69.24, 41.3]]));

    expect(new Set(map.fitBounds.mock.lastCall[0].points.map(String))).toEqual(new Set(['69.24,41.3']));
  });
});
