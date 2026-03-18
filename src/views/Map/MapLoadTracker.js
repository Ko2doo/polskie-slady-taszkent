/**
 * Creates a map load progress tracker for MapLibre maps.
 *
 * Tracks source loading events to calculate and report loading progress,
 * then signals readiness when the map reaches an idle state.
 *
 * Progress scale: startOffset% (initial) → 100% (all sources loaded)
 *
 * @param {Object} params - Tracker configuration
 * @param {maplibreGL.Map} params.map - MapLibre map instance to track
 * @param {function(number): void} params.setProgress - Callback to update progress (0–1)
 * @param {function(): void} params.setReady - Callback to signal map is ready
 * @param {number} [params.startOffset=40] - Initial progress percentage (0–100) before sources begin loading
 * @param {boolean} [params.debug=false] - Enable console logging. Automatically disabled in production via import.meta.env.DEV
 *
 * @returns {{ markSourcesAdded: function(): void }} - Tracker control API
 *
 * @example
 * const tracker = createMapLoadTracker({
 *   map,
 *   setProgress: (v) => (mapLoadingProgress = v),
 *   setReady: () => (mapReady = true),
 *   startOffset: 40,
 *   debug: import.meta.env.DEV,
 * });
 *
 * map.on('load', () => {
 *   setupMapHandlers({ map, builder });
 *   tracker.markSourcesAdded();
 * });
 */
export function createMapLoadTracker({ map, setProgress, setReady, startOffset = 40, debug = false }) {
  const loadingSources = new Set();
  const loadedSources = new Set();
  let sourcesAdded = false;

  const log = (...args) => debug && console.log('[MapLoadTracker]', ...args);

  setProgress(startOffset / 100);

  function update() {
    if (loadingSources.size === 0) return;

    const loadProgress = loadedSources.size / loadingSources.size;
    const percent = startOffset + Math.min(loadProgress, 1) * (100 - startOffset);
    const value = Math.min(percent, 100) / 100;

    log(
      `progress: ${Math.round(value * 100)}%`,
      `| loaded: ${loadedSources.size}/${loadingSources.size}`,
      `| sources: [${[...loadedSources].join(', ')}]`
    );

    setProgress(value);
  }

  map.on('sourcedataloading', (e) => {
    if (e?.sourceId) {
      const isNew = !loadingSources.has(e.sourceId);
      loadingSources.add(e.sourceId);

      if (isNew) log(`[MapLoadTracker] new source loading: "${e.sourceId}" | total: ${loadingSources.size}`);

      update();
    }
  });

  map.on('sourcedata', (e) => {
    if (e?.sourceId && e?.isSourceLoaded) {
      const isNew = !loadedSources.has(e.sourceId);
      loadedSources.add(e.sourceId);

      if (isNew)
        log(`[MapLoadTracker] source loaded: "${e.sourceId}" | loaded: ${loadedSources.size}/${loadingSources.size}`);

      update();
    }
  });

  map.on('idle', () => {
    log(
      `idle fired | sourcesAdded: ${sourcesAdded}`,
      `| loaded: ${loadedSources.size}/${loadingSources.size}`,
      `| pending: [${[...loadingSources].filter((id) => !loadedSources.has(id)).join(', ')}]`
    );

    if (!sourcesAdded) return;

    setProgress(1);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setReady(true);
      });
    });
  });

  return {
    /**
     * Signal that all map sources have been added to the map.
     * Must be called after builder.addMarkers() and builder.addCityBoundaryLayer()
     * inside the map 'load' event handler — only after this call will the
     * tracker respond to the 'idle' event and invoke setReady.
     */
    markSourcesAdded() {
      sourcesAdded = true;
      log(`[MapLoadTracker] markSourcesAdded called | loaded: ${loadedSources.size}/${loadingSources.size}`);
    },
  };
}
