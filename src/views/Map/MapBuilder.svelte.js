/**
 * MapBuilder Module
 *
 * Responsible for creating and configuring MapPointsBuilder instances.
 * Encapsulates all builder setup logic in a single, reusable function.
 */

import { MapPointsBuilder } from '@/services/mapPointsBuilder';
import { MARKER_CONFIG, BOUNDARY_CONFIG } from './MapConstants';
import { articlePopupState } from '@/lib/state/article.svelte';

/**
 * Create and configure MapPointsBuilder instance
 *
 * This function initializes the map points builder with all necessary
 * configuration for displaying article markers, labels, city boundaries,
 * and handling user interactions.
 *
 * @param {Object} params - Configuration parameters
 * @param {maplibreGL.Map} params.map - Initialized MapLibre map instance
 * @param {Array} params.data - Array of article metadata
 * @param {Object} params.i18n - i18n store with translation functions
 * @param {Function} params.popupTrigger - Svelte + KonstaUI popup state
 * @param {number} params.styleVersion - Current style version
 * @returns {MapPointsBuilder} - Configured builder instance
 */
export function createMapPointsBuilder({ map, data, i18n, popupTrigger, styleVersion }) {
  return (
    MapPointsBuilder.create()
      // Core configuration
      .withMap(map)
      .withData(data)
      .withStyleVersion(styleVersion)

      // i18n translations for UI elements
      .withI18n({
        title: (item) => i18n.t(`articles:${item.id}:title`),
        popupLink: () => i18n.t('ui:buttons:readMore'),
        popupGetOtherMaps: () => i18n.t('ui:buttons:popupGetOtherMaps'),
      })

      // SPA routing integration
      .withPopup(popupTrigger)

      // Markers configuration (custom icon and labels)
      .withMarkers(MARKER_CONFIG.customMarkers)

      // City boundary configuration
      .withCityBoundaries(BOUNDARY_CONFIG)

      // Finalize and validate configuration
      .build()
  );
}
