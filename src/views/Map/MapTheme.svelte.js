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
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const mapThemeLogger = createLogger('MapTheme');

// The version of the first style; every theme switch counts up from it. The builders are created
// with it before the theme controller exists (the controller needs the builders)
export const INITIAL_STYLE_VERSION = 0;

/**
 * The map theme for the app's current light/dark state. Read once to build the first style,
 * before the map (and its theme controller) exists.
 * @returns {'light'|'dark'} the theme to build the map style with
 */
export function getCurrentMapTheme() {
  return getThemeManager().getState().isDark ? 'dark' : 'light';
}

/**
 * Builds the MapLibre style for a theme: the bundled tiles, glyphs and sprites, labels in the
 * app language.
 * @param {'light'|'dark'} theme - which style flavor to build
 * @param {string} lang - i18next language code, e.g. 'ru'
 * @returns {Promise<Object>} the MapLibre style
 * @example
 * const style = await buildMapStyle(getCurrentMapTheme(), i18n.language);
 * const map = initializeMap({ container, style });
 */
export async function buildMapStyle(theme, lang) {
  return buildBaseMapStyle({
    origin: window.location.origin,
    pmtilesKey: PMTILES_KEY,
    theme,
    lang,
    fontstack: 'Roboto Regular',
  });
}

/**
 * Create theme controller
 *
 * @param {Object} params - Configuration parameters
 * @param {maplibreGL.Map} params.map - MapLibre map instance
 * @param {MapPointsBuilder} params.builder - MapPointsBuilder instance
 * @param {CustomPointsBuilder} params.customPointsBuilder - CustomPointsBuilder instance
 * @param {Object} params.navigation - Navigation controller
 * @param {() => Object|null} [params.getCurrentRoute] - The route to redraw after a style switch
 *   (`map.setStyle()` drops every app layer). Defaults to the manual navigation's route; the map
 *   screen passes one that also covers GPS navigation, which this controller doesn't know.
 * @param {Object} params.i18n - i18n store
 * @returns {Object} - Theme controller API
 */
export function createThemeController({
  map,
  builder,
  customPointsBuilder,
  navigation,
  getCurrentRoute = () => navigation?.currentRoute,
  i18n,
}) {
  const themeManager = getThemeManager();

  let uiThemeStyle = $state('light');
  let styleVersion = $state(INITIAL_STYLE_VERSION);
  let unsubscribeTheme = null;

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

    // Restore user-created points (they are kept in the builder memory)
    if (customPointsBuilder) {
      customPointsBuilder.init();
    }

    // Restore navigation route if exists
    if (currentRoute) {
      builder.addNavigationRoute(currentRoute);
    }

    // Restore navigation markers
    navigation.restoreMarkers();

    IS_DEBUG && mapThemeLogger.log('Overlays restored');
  }

  /**
   * Apply theme to map
   */
  async function applyTheme(theme) {
    if (!map) {
      IS_DEBUG && mapThemeLogger.warn('Cannot apply theme: map not initialized');
      return;
    }

    try {
      uiThemeStyle = theme;

      // Increment style version for tracking
      styleVersion += 1;
      const myVersion = styleVersion;

      // Build new style
      const style = await buildMapStyle(theme, i18n.language);
      map.setStyle(style);

      // Wait for style to load
      const onIdle = () => {
        // One-shot either way: an outdated handler must go too, or every quick switch leaves one
        map.off('idle', onIdle);

        // Check if style version is still current
        if (myVersion !== styleVersion) {
          IS_DEBUG && mapThemeLogger.log('Style version changed, aborting restoration');
          return;
        }

        // Update builder style version
        builder.setStyleVersion(myVersion);

        if (customPointsBuilder) {
          customPointsBuilder.setStyleVersion(myVersion);
        }

        // Restore all overlays
        reapplyOverlays(getCurrentRoute());
      };

      map.on('idle', onIdle);

      IS_DEBUG && mapThemeLogger.log('Theme applied:', theme);
    } catch (error) {
      IS_DEBUG && mapThemeLogger.error('Failed to apply theme:', error);

      errorToast.error(i18n.t('errors:mapThemeFailed'), {
        scope: 'MapTheme',
        code: ERROR_CODES.MAP_THEME_FAILED,
      });
    }
  }

  /**
   * Start following the app theme.
   * @param {'light'|'dark'} [builtWith] - the theme the map's current style was built with. The
   *   app theme may have changed since (the style is built before the map loads); the subscription
   *   reports the current theme right away, so a difference is applied at once
   * @returns {'light'|'dark'} the theme the map has now, or is switching to
   */
  function init(builtWith = getCurrentMapTheme()) {
    uiThemeStyle = builtWith;

    // Subscribe to theme changes; called right away with the current theme
    unsubscribeTheme = themeManager.subscribe(({ isDark }) => {
      const nextTheme = isDark ? 'dark' : 'light';

      if (nextTheme === uiThemeStyle) return;

      applyTheme(nextTheme);
    });

    IS_DEBUG && mapThemeLogger.log('Initialized with theme:', uiThemeStyle);

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

    IS_DEBUG && mapThemeLogger.log('Disposed');
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
    dispose,
  };
}
