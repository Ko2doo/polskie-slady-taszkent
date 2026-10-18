/**
 * MapUserMarker Module
 *
 * The user's own position on the map (the pulsing dot of GPS navigation): created on the first
 * position, moved on the next ones, removed when GPS navigation is cleared. Styled by
 * `.user-location-marker` in `assets/styles/maplibre.css`.
 */

import * as maplibreGL from 'maplibre-gl';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const userMarkerLogger = createLogger('UserMarker');

function createMarkerElement() {
  const element = document.createElement('div');
  element.className = 'user-location-marker';
  element.innerHTML = `
    <div class="pulse-ring"></div>
    <div class="user-dot"></div>
  `;
  return element;
}

/**
 * Create the user-position marker of one map — nothing is on the map until the first `show()`.
 *
 * @param {maplibreGL.Map} map - MapLibre map instance
 * @returns {{ show: (position: { lat: number, lon: number }) => void, remove: () => void }}
 *   `show` adds the marker on the first call and moves it afterwards; `remove` takes it off the
 *   map (safe to call when nothing is shown) — the next `show` adds a fresh one.
 *
 * @example
 * const userMarker = createUserMarker(map);
 * tracker = createGPSTracker({ onPositionUpdate: (position) => userMarker.show(position) });
 * // GPS navigation cleared or the screen left:
 * userMarker.remove();
 */
export function createUserMarker(map) {
  let marker = null;

  function show({ lat, lon }) {
    if (marker) {
      marker.setLngLat([lon, lat]);
      return;
    }

    marker = new maplibreGL.Marker({ element: createMarkerElement(), anchor: 'center' })
      .setLngLat([lon, lat])
      .addTo(map);
    IS_DEBUG && userMarkerLogger.log('User marker created');
  }

  function remove() {
    if (!marker) return;

    marker.remove();
    marker = null;
  }

  return { show, remove };
}
