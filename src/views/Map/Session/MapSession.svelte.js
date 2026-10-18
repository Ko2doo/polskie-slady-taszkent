import { articlesMeta } from '@/data/articles';
import { articlePopupState } from '@/lib/state/article.svelte.js';
import { customPointsState } from '@/lib/state/customPointsState.svelte.js';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { errorToast } from '@/store/ui/errorToast';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';
import { cleanupMap, initializeMap, initializePMTiles, setupMapHandlers } from './MapLifecycle.svelte.js';
import { createCustomPointsBuilder, createMapPointsBuilder } from '@/views/Map/Points/MapBuilder.svelte.js';
import { createNavigationController } from '@/views/Map/Navigation/MapNavigation.svelte.js';
import { createGPSNavigationController } from '@/views/Map/Navigation/GPS/MapNavigationGPS.svelte.js';
import { buildMapStyle, createThemeController, getCurrentMapTheme, INITIAL_STYLE_VERSION } from './MapTheme.svelte.js';
import { createMapLoadTracker } from './MapLoadTracker.js';
import { createPreviewTracker } from '@/views/Map/Points/MapPreview.js';
import { MAP_BOUNDS } from '@/views/Map/MapConstants.js';

const sessionLogger = createLogger('MapSession');

// Thrown at a checkpoint once the session is disposed: unwinds start() quietly, no error toast
const CANCELLED = Symbol('map session cancelled');

/**
 * Everything the map screen builds on a MapLibre map, from the tiles to the theme controller, and
 * the one place it's all released. The screen calls `start()` on mount and `dispose()` on unmount;
 * the session owns the order of the steps and their cleanup.
 *
 * Leaving the screen while it still loads is the hard case: `dispose()` runs while `start()` waits
 * for the tiles, the style or the saved points. `dispose()` releases what exists at that moment;
 * `start()` checks after every wait and, once disposed, releases what it created since and stops —
 * so nothing is left alive on a detached container (a WebGL context each time) and nothing is
 * built on a removed map.
 *
 * @param {Object} options - what the session needs from the screen
 * @param {Object} options.i18n - the i18next instance (`$i18n`)
 * @param {() => boolean} options.isPopupEnabled - whether a marker tap may open its popup now
 * @param {() => Array<number>|null} options.getTargetCoords - `[lon, lat]` to fly to once loaded
 * @param {(event: Object) => void} options.onMapClick - the screen's map click handler
 * @param {(progress: number) => void} options.onProgress - load progress, 0..1
 * @param {() => void} options.onReady - every source has loaded
 * @returns {{ start: (container: HTMLElement) => Promise<boolean>, dispose: () => void,
 *   readonly builder: Object|null, readonly customPointsBuilder: Object|null,
 *   readonly navigation: Object|null, readonly gpsNavigation: Object|null,
 *   readonly previews: ReturnType<typeof createPreviewTracker>, showPreview: (point: Object) => Promise<void> }} `navigation` and `gpsNavigation`
 *   are reactive; `start` resolves to true once everything is built, false when it failed (the user
 *   was told) or the session was disposed meanwhile
 * @example
 * const session = createMapSession({ i18n: $i18n, isPopupEnabled, getTargetCoords, onMapClick,
 *   onProgress: (value) => (progress = value), onReady: () => (ready = true) });
 *
 * onMount(() => {
 *   session.start(container).then((isStarted) => isStarted && afterStart());
 *   return () => session.dispose();
 * });
 */
export function createMapSession({ i18n, isPopupEnabled, getTargetCoords, onMapClick, onProgress, onReady }) {
  let isDisposed = false;

  let protocol = null;
  let map = null;
  let builder = null;
  let customPointsBuilder = null;
  let theme = null;
  let navigation = $state(null);
  let gpsNavigation = $state(null);
  // The photo urls the custom points' popups hold (released on change, delete and dispose)
  const previews = createPreviewTracker();

  const openArticle = (id) => articlePopupState.open(id);

  function checkpoint() {
    if (isDisposed) throw CANCELLED;
  }

  function createBuilders() {
    const builderOptions = {
      map,
      i18n,
      popupTrigger: openArticle,
      isPopupEnabled,
      styleVersion: INITIAL_STYLE_VERSION,
    };

    builder = createMapPointsBuilder({ ...builderOptions, data: articlesMeta });
    customPointsBuilder = createCustomPointsBuilder(builderOptions);
  }

  // A point's cover photo, resolved in the background, becomes its popup preview — after the start
  // and after every edit (MapCustomPointsEditor). The map can be gone by then: the url is given
  // back at once instead of being held for a released map
  async function showPreview(point) {
    const preview = await previews.resolve(point);

    if (!customPointsBuilder) {
      previews.release(point.id);
      return;
    }

    customPointsBuilder.updatePoint({ id: point.id, title: point.title, preview });
  }

  // The points state outlives the screen: put the already created points back on the map right
  // away, and their cover photos as they resolve — the map doesn't wait for every photo
  async function restoreSavedPoints() {
    await customPointsState.ready;
    checkpoint();

    const savedPoints = [...customPointsState.points];

    savedPoints.forEach((point) => {
      customPointsBuilder.addPoint({ id: point.id, coords: point.coords, title: point.title, preview: '' });
    });

    savedPoints.forEach((point) => showPreview(point));
  }

  // `initialTheme` is the theme the style was built with: the controller applies a theme that
  // changed while the map loaded
  function createControllers(initialTheme) {
    navigation = createNavigationController({ map, builder, i18n });
    gpsNavigation = createGPSNavigationController({ map, builder, i18n });

    theme = createThemeController({ map, i18n, onStyleRestored: restoreAfterStyleChange });
    theme.init(initialTheme);
  }

  // A theme switch replaced the style, and with it every source, layer and image added below:
  // put it all back in the order it was first added. Whatever start() adds to the map is restored
  // here too, or it disappears on the first theme switch
  function restoreAfterStyleChange(styleVersion) {
    if (!map) return;

    builder.setStyleVersion(styleVersion);
    customPointsBuilder.setStyleVersion(styleVersion);

    map.setMaxBounds(MAP_BOUNDS);
    builder.addCityBoundaryLayer();
    builder.addMarkers();
    // The custom points are kept in the builder's memory
    customPointsBuilder.init();

    // One route layer serves both navigations; at most one of them has a route
    const route = navigation?.currentRoute ?? gpsNavigation?.currentRoute;
    if (route) builder.addNavigationRoute(route);

    navigation.restoreMarkers();

    IS_DEBUG && sessionLogger.log('Map content restored after a style change');
  }

  function attachWhenLoaded(tracker) {
    map.on('load', () => {
      setupMapHandlers({ map, builder, customPointsBuilder, navigation, targetCoords: getTargetCoords() });
      map.on('click', onMapClick);
      tracker.markSourcesAdded();
    });
  }

  async function start(container) {
    IS_DEBUG && sessionLogger.log('Starting...');

    try {
      // The tiles and the style don't depend on each other: load them side by side. The tiles are
      // kept as soon as they're in, so a failed style or a dispose meanwhile still releases them
      const initialTheme = getCurrentMapTheme();
      const tiles = initializePMTiles(i18n).then((loaded) => {
        protocol = loaded;
        if (isDisposed) release();
      });
      const [, style] = await Promise.all([tiles, buildMapStyle(initialTheme, i18n.language)]);
      checkpoint();

      map = initializeMap({ container, style });
      const tracker = createMapLoadTracker({ map, setProgress: onProgress, setReady: onReady });

      createBuilders();
      await restoreSavedPoints();
      createControllers(initialTheme);
      attachWhenLoaded(tracker);

      IS_DEBUG && sessionLogger.log('Started');
      return true;
    } catch (error) {
      if (error === CANCELLED) {
        IS_DEBUG && sessionLogger.log('Disposed while starting, releasing what was created since');
        release();
        return false;
      }

      IS_DEBUG && sessionLogger.error('Start failed:', error);
      errorToast.error(i18n.t('errors:mapInitFailed'), { scope: 'Map', code: ERROR_CODES.MAP_INIT_FAILED });
      return false;
    }
  }

  // Safe to call more than once: what was released is null afterwards
  function release() {
    previews.releaseAll();

    if (map) map.off('click', onMapClick);

    cleanupMap({ map, protocol, builder, customPointsBuilder, navigation, theme });

    if (gpsNavigation) gpsNavigation.dispose();

    protocol = null;
    map = null;
    builder = null;
    customPointsBuilder = null;
    theme = null;
    navigation = null;
    gpsNavigation = null;
  }

  function dispose() {
    IS_DEBUG && sessionLogger.log('Disposing...');

    isDisposed = true;
    release();
  }

  return {
    start,
    dispose,
    get builder() {
      return builder;
    },
    get customPointsBuilder() {
      return customPointsBuilder;
    },
    get navigation() {
      return navigation;
    },
    get gpsNavigation() {
      return gpsNavigation;
    },
    previews,
    showPreview,
  };
}
