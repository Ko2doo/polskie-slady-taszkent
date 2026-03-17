export function createMapLoadTracker({ map, setProgress, setReady, startOffset = 40 }) {
  let started = 0;
  let completed = 0;
  let sourcesAdded = false;

  setProgress(startOffset / 100);

  function update() {
    if (started === 0) return;

    const loadProgress = Math.min(completed / started, 1);
    const percent = startOffset + loadProgress * (100 - startOffset);

    setProgress(Math.min(percent, 100) / 100);
  }

  map.on('sourcedataloading', (e) => {
    console.log('[Tracker] sourcedataloading', e?.sourceDataType, 'started:', started);
    started++;
    update();
  });

  map.on('sourcedata', (e) => {
    console.log('[Tracker] sourcedata', e?.sourceDataType, 'completed:', completed);
    if (e?.isSourceLoaded) {
      completed++;
      update();
    }
  });

  map.on('idle', () => {
    console.log('[Tracker] idle fired, sourcesAdded:', sourcesAdded);
    if (!sourcesAdded) return;

    setProgress(1);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setReady(true);
      });
    });
  });

  return {
    markSourcesAdded() {
      sourcesAdded = true;
    },
  };
}
