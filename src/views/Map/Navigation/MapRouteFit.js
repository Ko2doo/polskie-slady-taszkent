/**
 * MapRouteFit Module
 *
 * Moves the camera so a whole route is in view — shared by point-to-point and GPS navigation.
 */

import * as maplibreGL from 'maplibre-gl';
import { ROUTE_FIT_PADDING } from '@/views/Map/MapConstants';

/**
 * Fit the map's camera to a route's full extent, leaving ROUTE_FIT_PADDING around it.
 *
 * @param {maplibreGL.Map} map - MapLibre map instance
 * @param {{ geometry: { coordinates: Array<[number, number]> } }} route - a GeoJSON LineString
 *   feature, as `findRoute()` returns it (`result.route`); needs at least one coordinate
 * @returns {void}
 *
 * @example
 * const result = findRoute(fromLon, fromLat, toLon, toLat);
 * if (result.success) fitMapToRoute(map, result.route);
 */
export function fitMapToRoute(map, route) {
  const coordinates = route.geometry.coordinates;
  const bounds = new maplibreGL.LngLatBounds(coordinates[0], coordinates[0]);
  for (const coordinate of coordinates) bounds.extend(coordinate);

  map.fitBounds(bounds, { padding: ROUTE_FIT_PADDING });
}
