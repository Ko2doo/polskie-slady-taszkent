import { createLogger, IS_DEBUG } from '@/utils/debugMode';

/**
 * Creates a map load progress tracker for MapLibre maps.
 *
 * Tracks source loading events to calculate and report loading progress,
 * then signals readiness when the map reaches an idle state.
 *
 * Progress scale: startOffset% (initial) -> 100% (all sources loaded)
 *
 * @param {Object} params - Tracker configuration
 * @param {maplibreGL.Map} params.map - MapLibre map instance to track
 * @param {function(number): void} params.setProgress - Callback to update progress (0–1)
 * @param {function(): void} params.setReady - Callback to signal map is ready
 * @param {number} [params.startOffset=40] - Initial progress percentage (0–100) before sources begin loading
 *
 * @returns {{ markSourcesAdded: function(): void }} - Tracker control API
 *
 * @example
 * const tracker = createMapLoadTracker({
 *   map,
 *   setProgress: (v) => (mapLoadingProgress = v),
 *   setReady: () => (mapReady = true),
 *   startOffset: 40,
 * });
 *
 * map.on('load', () => {
 *   setupMapHandlers({ map, builder });
 *   tracker.markSourcesAdded();
 * });
 */
export function createMapLoadTracker({ map, setProgress, setReady, startOffset = 40 }) {
  const loadingSources = new Set();
  const loadedSources = new Set();
  let sourcesAdded = false;

  const trackerLogger = createLogger('MapLoadTracker');

  setProgress(startOffset / 100);

  function update() {
    if (loadingSources.size === 0) return;

    const loadProgress = loadedSources.size / loadingSources.size;
    const percent = startOffset + Math.min(loadProgress, 1) * (100 - startOffset);
    const value = Math.min(percent, 100) / 100;

    IS_DEBUG &&
      trackerLogger.log(
        `progress: ${Math.round(value * 100)}%`,
        `| loaded: ${loadedSources.size}/${loadingSources.size}`,
        `| sources: [${[...loadedSources].join(', ')}]`,
      );

    setProgress(value);
  }

  function onSourceDataLoading(e) {
    if (e?.sourceId) {
      const isNew = !loadingSources.has(e.sourceId);
      loadingSources.add(e.sourceId);

      if (isNew && IS_DEBUG) trackerLogger.log(`new source loading: "${e.sourceId}" | total: ${loadingSources.size}`);

      update();
    }
  }

  function onSourceData(e) {
    if (e?.sourceId && e?.isSourceLoaded) {
      const isNew = !loadedSources.has(e.sourceId);
      loadedSources.add(e.sourceId);

      if (isNew && IS_DEBUG)
        trackerLogger.log(`source loaded: "${e.sourceId}" | loaded: ${loadedSources.size}/${loadingSources.size}`);

      update();
    }
  }

  function onIdle() {
    IS_DEBUG &&
      trackerLogger.log(
        `idle fired | sourcesAdded: ${sourcesAdded}`,
        `| loaded: ${loadedSources.size}/${loadingSources.size}`,
        `| pending: [${[...loadingSources].filter((id) => !loadedSources.has(id)).join(', ')}]`,
      );

    if (!sourcesAdded) return;

    // Unsubscribe all events - tracker`s need only for first loading.
    map.off('sourcedataloading', onSourceDataLoading);
    map.off('sourcedata', onSourceData);
    map.off('idle', onIdle);

    IS_DEBUG && trackerLogger.log('tracker disposed');

    setProgress(1);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setReady(true);
      });
    });
  }

  map.on('sourcedataloading', onSourceDataLoading);
  map.on('sourcedata', onSourceData);
  map.on('idle', onIdle);

  return {
    /**
     * Signal that all map sources have been added to the map.
     * Must be called after builder.addMarkers() and builder.addCityBoundaryLayer()
     * inside the map 'load' event handler — only after this call will the
     * tracker respond to the 'idle' event and invoke setReady.
     */
    markSourcesAdded() {
      sourcesAdded = true;
      IS_DEBUG && trackerLogger.log(`markSourcesAdded called | loaded: ${loadedSources.size}/${loadingSources.size}`);
    },
  };
}
