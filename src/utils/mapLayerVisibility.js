/**
 * Show / hide MapLibre layers
 */

/**
 * MapLibre layout `visibility` value for a boolean flag
 * @param {boolean} isVisible - true to show, false to hide
 * @returns {'visible'|'none'}
 */
export function getLayerVisibility(isVisible) {
  return isVisible ? 'visible' : 'none';
}

/**
 * Apply visibility to already existing layers (layers that are not on the map yet are skipped)
 * @param {maplibreGL.Map} map - Initialized MapLibre map
 * @param {Array<string>} layerIds - Ids of the layers
 * @param {boolean} isVisible - true to show, false to hide
 */
export function setLayersVisibility(map, layerIds, isVisible) {
  const visibility = getLayerVisibility(isVisible);

  layerIds.forEach((layerId) => {
    if (!map.getLayer(layerId)) return;

    map.setLayoutProperty(layerId, 'visibility', visibility);
  });
}
