/**
 * MapTheme Module
 *
 * Manages map theme (light/dark) switching:
 * - Subscribes to global theme manager
 * - Rebuilds map style when theme changes
 * - Restores overlays (markers, routes, boundaries) after style change
 */

import { buildBaseMapStyle } from '@/services/mapStyle';
import { errorToast } from '@/store/ui/errorToast';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { getThemeManager } from '@/lib/theme/themeManager';
import { PMTILES_KEY, MAP_BOUNDS } from './MapConstants';

/**
 * Create theme controller
 *
 * @param {Object} params - Configuration parameters
 * @param {maplibreGL.Map} params.map - MapLibre map instance
 * @param {MapPointsBuilder} params.builder - MapPointsBuilder instance
 * @param {Object} params.navigation - Navigation controller
 * @param {Object} params.i18n - i18n store
 * @returns {Object} - Theme controller API
 */
export function createThemeController({ map, builder, navigation, i18n }) {
  const themeManager = getThemeManager();

  let uiThemeStyle = $state('light');
  let styleVersion = $state(0);
  let unsubscribeTheme = null;

  /**
   * Build map style for given theme
   * @private
   */
  async function buildStyleForTheme(theme) {
    const origin = window.location.origin;

    return buildBaseMapStyle({
      origin,
      pmtilesKey: PMTILES_KEY,
      theme,
      lang: i18n.language,
      fontstack: 'Roboto Regular',
    });
  }

  /**
   * Reapply all map overlays after style change
   * @private
   */
  function reapplyOverlays(currentRoute) {
    if (!map || !builder) return;

    // Restore map bounds
    map.setMaxBounds(MAP_BOUNDS);

    // Restore layers
    builder.addCityBoundaryLayer();
    builder.addMarkers();

    // Restore navigation route if exists
    if (currentRoute) {
      builder.addNavigationRoute(currentRoute);
    }

    // Restore navigation markers
    navigation.restoreMarkers();

    // Re-attach click handler
    map.off('click', navigation.handleMapClick);
    map.on('click', navigation.handleMapClick);

    console.log('[MapTheme] Overlays restored');
  }

  /**
   * Apply theme to map
   */
  async function applyTheme(theme) {
    if (!map) {
      console.warn('[MapTheme] Cannot apply theme: map not initialized');
      return;
    }

    try {
      uiThemeStyle = theme;

      // Increment style version for tracking
      styleVersion += 1;
      const myVersion = styleVersion;

      // Build new style
      const style = await buildStyleForTheme(theme);
      map.setStyle(style);

      // Wait for style to load
      const onIdle = () => {
        // Check if style version is still current
        if (myVersion !== styleVersion) {
          console.log('[MapTheme] Style version changed, aborting restoration');
          return;
        }

        map.off('idle', onIdle);

        // Update builder style version
        builder.setStyleVersion(myVersion);

        // Restore all overlays
        reapplyOverlays(navigation.currentRoute);
      };

      map.on('idle', onIdle);

      console.log('[MapTheme] Theme applied:', theme);
    } catch (error) {
      console.error('[MapTheme] Failed to apply theme:', error);

      errorToast.error(i18n.t('ui:errors:mapThemeFailed'), {
        scope: 'MapTheme',
        code: ERROR_CODES.MAP_THEME_FAILED,
      });
    }
  }

  /**
   * Initialize theme controller
   */
  function init() {
    // Get initial theme
    const isDark = themeManager.getState().isDark;
    uiThemeStyle = isDark ? 'dark' : 'light';

    // Subscribe to theme changes
    unsubscribeTheme = themeManager.subscribe(({ isDark }) => {
      const nextTheme = isDark ? 'dark' : 'light';

      if (nextTheme === uiThemeStyle) return;

      applyTheme(nextTheme);
    });

    console.log('[MapTheme] Initialized with theme:', uiThemeStyle);

    return uiThemeStyle;
  }

  /**
   * Cleanup theme subscriptions
   */
  function dispose() {
    if (unsubscribeTheme) {
      unsubscribeTheme();
      unsubscribeTheme = null;
    }

    console.log('[MapTheme] Disposed');
  }

  // ========================================
  // PUBLIC API
  // ========================================

  return {
    // State
    get currentTheme() {
      return uiThemeStyle;
    },
    get styleVersion() {
      return styleVersion;
    },

    // Actions
    init,
    applyTheme,
    buildStyleForTheme,
    dispose,
  };
}
