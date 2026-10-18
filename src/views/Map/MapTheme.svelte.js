/**
 * MapTheme Module
 *
 * Manages map theme (light/dark) switching:
 * - Subscribes to global theme manager
 * - Rebuilds map style when theme changes
 * - Tells its owner when the new style is loaded, so the app's own map content can be put back
 */

import { buildBaseMapStyle } from '@/services/mapStyle';
import { errorToast } from '@/store/ui/errorToast';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { getThemeManager } from '@/lib/theme/themeManager';
import { PMTILES_KEY } from './MapConstants';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const mapThemeLogger = createLogger('MapTheme');

// The version of the first style; every theme switch counts up from it. The builders are tagged
// with it when they're created, before any theme controller exists
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
 * Follows the app's light/dark theme and switches the map style with it.
 *
 * `map.setStyle()` drops every source, layer and image the app added on top of the base style.
 * Putting them back is not this controller's job — it doesn't know what's on the map: once the
 * new style has loaded it calls `onStyleRestored(version)`, and the owner of the map's content
 * (MapSession.svelte.js) restores it. Only the latest switch calls back: a quick second switch
 * makes the first one's style outdated before it loads.
 *
 * @param {Object} params - what the controller works with
 * @param {Object} params.map - the MapLibre map
 * @param {Object} params.i18n - the i18next instance, for the style's label language and errors
 * @param {(styleVersion: number) => void} params.onStyleRestored - the new style is loaded; put
 *   the app's own map content back, tagged with this version
 * @returns {{ readonly currentTheme: 'light'|'dark', readonly styleVersion: number,
 *   init: (builtWith?: 'light'|'dark') => 'light'|'dark', applyTheme: (theme: 'light'|'dark') => Promise<void>,
 *   dispose: () => void }} the controller; `currentTheme` and `styleVersion` are reactive
 * @example
 * const theme = createThemeController({ map, i18n, onStyleRestored: (version) => restoreOverlays(version) });
 * theme.init(initialTheme); // the theme the first style was built with
 */
export function createThemeController({ map, i18n, onStyleRestored }) {
  const themeManager = getThemeManager();

  let uiThemeStyle = $state('light');
  let styleVersion = $state(INITIAL_STYLE_VERSION);
  let unsubscribeTheme = null;

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

        onStyleRestored(myVersion);
        IS_DEBUG && mapThemeLogger.log('Style loaded, map content restored');
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
