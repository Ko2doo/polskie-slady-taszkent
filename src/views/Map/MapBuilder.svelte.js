/**
 * MapBuilder Module
 *
 * Responsible for creating and configuring MapPointsBuilder instances.
 * Encapsulates all builder setup logic in a single, reusable function.
 */

import { MapPointsBuilder } from '@/services/mapPointsBuilder';
import { CustomPointsBuilder } from '@/services/customPointsBuilder';
import { MARKER_CONFIG, BOUNDARY_CONFIG, CUSTOM_POINTS_CONFIG } from './MapConstants';
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
 * @param {Function} params.isPopupEnabled - Returns false while popups must not open (e.g. navigation modes)
 * @param {number} params.styleVersion - Current style version
 * @returns {MapPointsBuilder} - Configured builder instance
 */
export function createMapPointsBuilder({ map, data, i18n, popupTrigger, isPopupEnabled, styleVersion }) {
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
      })

      // SPA routing integration
      .withPopup(popupTrigger)
      .withPopupGuard(isPopupEnabled)

      // Markers configuration (custom icon and labels)
      .withMarkers(MARKER_CONFIG.customMarkers)

      // City boundary configuration
      .withCityBoundaries(BOUNDARY_CONFIG)

      // Finalize and validate configuration
      .build()
  );
}

/**
 * Create and configure CustomPointsBuilder instance
 *
 * Renders points created by the user in the map editor mode.
 * The article text is not passed to the builder: the popup button only calls
 * popupTrigger with the point id, the article popup resolves the text by this id.
 *
 * @param {Object} params - Configuration parameters
 * @param {maplibreGL.Map} params.map - Initialized MapLibre map instance
 * @param {Object} params.i18n - i18n store with translation functions
 * @param {Function} params.popupTrigger - Svelte + KonstaUI popup state
 * @param {Function} params.isPopupEnabled - Returns false while popups must not open (map editor mode)
 * @param {number} params.styleVersion - Current style version
 * @returns {CustomPointsBuilder} - Configured builder instance
 */
export function createCustomPointsBuilder({ map, i18n, popupTrigger, isPopupEnabled, styleVersion }) {
  return (
    CustomPointsBuilder.create()
      // Core configuration
      .withMap(map)
      .withStyleVersion(styleVersion)

      // i18n translations for UI elements
      .withI18n({
        popupLink: () => i18n.t('ui:buttons:readMore'),
      })

      // SPA routing integration
      .withPopup(popupTrigger)
      .withPopupGuard(isPopupEnabled)

      // Markers configuration (icons, source and layer names)
      .withMarkers(CUSTOM_POINTS_CONFIG)

      // Finalize and validate configuration
      .build()
  );
}
