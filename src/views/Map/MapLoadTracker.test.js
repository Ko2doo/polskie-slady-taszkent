import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMapLoadTracker } from '@/views/Map/MapLoadTracker';

// A recorder of the MapLibre event API: `emit` plays the role of the map firing an event
function createMapRecorder() {
  const handlers = new Map();

  return {
    on: vi.fn((event, handler) => handlers.set(event, handler)),
    off: vi.fn((event, handler) => {
      if (handlers.get(event) === handler) handlers.delete(event);
    }),
    emit: (event, payload) => handlers.get(event)?.(payload),
    listens: (event) => handlers.has(event),
  };
}

let map;
let setProgress;
let setReady;

beforeEach(() => {
  map = createMapRecorder();
  setProgress = vi.fn();
  setReady = vi.fn();
  // Run the double requestAnimationFrame at once
  vi.stubGlobal('requestAnimationFrame', (callback) => callback());
});

const lastProgress = () => setProgress.mock.lastCall[0];

describe('createMapLoadTracker', () => {
  it('starts at the offset', () => {
    createMapLoadTracker({ map, setProgress, setReady, startOffset: 40 });

    expect(lastProgress()).toBe(0.4);
  });

  it('moves from the offset to 100% as the sources load', () => {
    createMapLoadTracker({ map, setProgress, setReady, startOffset: 40 });

    map.emit('sourcedataloading', { sourceId: 'protomaps' });
    map.emit('sourcedataloading', { sourceId: 'points' });
    expect(lastProgress()).toBe(0.4);

    map.emit('sourcedata', { sourceId: 'protomaps', isSourceLoaded: true });
    expect(lastProgress()).toBeCloseTo(0.7);

    map.emit('sourcedata', { sourceId: 'points', isSourceLoaded: true });
    expect(lastProgress()).toBeCloseTo(1);
  });

  it('a source counts once, however many events it fires', () => {
    createMapLoadTracker({ map, setProgress, setReady, startOffset: 0 });
    map.emit('sourcedataloading', { sourceId: 'a' });
    map.emit('sourcedataloading', { sourceId: 'b' });

    map.emit('sourcedata', { sourceId: 'a', isSourceLoaded: true });
    map.emit('sourcedata', { sourceId: 'a', isSourceLoaded: true });

    expect(lastProgress()).toBe(0.5);
  });

  it('ignores events without a source or not yet loaded', () => {
    createMapLoadTracker({ map, setProgress, setReady, startOffset: 0 });
    map.emit('sourcedataloading', { sourceId: 'a' });
    setProgress.mockClear();

    map.emit('sourcedataloading', {});
    map.emit('sourcedata', { sourceId: 'a', isSourceLoaded: false });
    map.emit('sourcedata', undefined);

    expect(setProgress).not.toHaveBeenCalled();
  });

  it('never goes past 100%', () => {
    createMapLoadTracker({ map, setProgress, setReady, startOffset: 40 });
    map.emit('sourcedataloading', { sourceId: 'a' });

    map.emit('sourcedata', { sourceId: 'a', isSourceLoaded: true });
    map.emit('sourcedata', { sourceId: 'b', isSourceLoaded: true });

    expect(lastProgress()).toBeLessThanOrEqual(1);
  });

  // The map is idle before the app's own sources exist: that is not "ready" yet
  it('an idle map is not ready until the sources were added', () => {
    const tracker = createMapLoadTracker({ map, setProgress, setReady });

    map.emit('idle');
    expect(setReady).not.toHaveBeenCalled();

    tracker.markSourcesAdded();
    map.emit('idle');

    expect(lastProgress()).toBe(1);
    expect(setReady).toHaveBeenCalledWith(true);
  });

  it('stops listening once ready (it is only for the first load)', () => {
    const tracker = createMapLoadTracker({ map, setProgress, setReady });
    tracker.markSourcesAdded();

    map.emit('idle');

    expect(map.listens('sourcedataloading')).toBe(false);
    expect(map.listens('sourcedata')).toBe(false);
    expect(map.listens('idle')).toBe(false);
  });
});
