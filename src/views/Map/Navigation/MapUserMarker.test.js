import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createdMarkers, createMapRecorder, markersOnMap } from '@/test/mapRecorders';
import { createUserMarker } from './MapUserMarker';

vi.mock('maplibre-gl', async () => (await import('@/test/mapRecorders')).maplibreRecorder);

const HOME = { lat: 41.3, lon: 69.24 };
const NEXT = { lat: 41.31, lon: 69.25 };

let map;
let userMarker;

beforeEach(() => {
  createdMarkers.length = 0;
  map = createMapRecorder();
  userMarker = createUserMarker(map);
});

describe('user marker', () => {
  it('nothing is on the map before the first position', () => {
    expect(createdMarkers).toHaveLength(0);
  });

  it('the first position adds the pulsing dot there, centered on it', () => {
    userMarker.show(HOME);

    expect(markersOnMap()).toHaveLength(1);
    const [marker] = markersOnMap();
    expect(marker.map).toBe(map);
    expect(marker.lngLat).toEqual([HOME.lon, HOME.lat]);
    expect(marker.options.anchor).toBe('center');
    expect(marker.options.element.className).toBe('user-location-marker');
    expect(marker.options.element.querySelector('.pulse-ring')).not.toBeNull();
    expect(marker.options.element.querySelector('.user-dot')).not.toBeNull();
  });

  it('next positions move the same marker', () => {
    userMarker.show(HOME);
    userMarker.show(NEXT);

    expect(createdMarkers).toHaveLength(1);
    expect(markersOnMap()[0].lngLat).toEqual([NEXT.lon, NEXT.lat]);
  });

  it('remove takes it off the map; the next position adds a fresh one', () => {
    userMarker.show(HOME);
    userMarker.remove();

    expect(markersOnMap()).toHaveLength(0);

    userMarker.show(NEXT);
    expect(createdMarkers).toHaveLength(2);
    expect(markersOnMap()).toEqual([createdMarkers[1]]);
  });

  it('remove with nothing shown does nothing', () => {
    expect(() => userMarker.remove()).not.toThrow();
    expect(createdMarkers).toHaveLength(0);
  });

  it('remove is idempotent', () => {
    userMarker.show(HOME);
    userMarker.remove();
    userMarker.remove();

    expect(createdMarkers[0].remove).toHaveBeenCalledTimes(1);
  });
});
