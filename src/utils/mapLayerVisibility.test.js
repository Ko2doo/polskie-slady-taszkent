import { describe, it, expect, vi } from 'vitest';
import { getLayerVisibility, setLayersVisibility } from '@/utils/mapLayerVisibility';

// Records every call; only layers listed in `existing` are "on the map".
function createMapRecorder(existing) {
  return {
    getLayer: vi.fn((id) => (existing.includes(id) ? { id } : undefined)),
    setLayoutProperty: vi.fn(),
  };
}

describe('getLayerVisibility', () => {
  it('maps a boolean to the MapLibre value', () => {
    expect(getLayerVisibility(true)).toBe('visible');
    expect(getLayerVisibility(false)).toBe('none');
  });
});

describe('setLayersVisibility', () => {
  it('sets visibility on every existing layer', () => {
    const map = createMapRecorder(['a', 'b']);

    setLayersVisibility(map, ['a', 'b'], false);

    expect(map.setLayoutProperty.mock.calls).toEqual([
      ['a', 'visibility', 'none'],
      ['b', 'visibility', 'none'],
    ]);
  });

  it('skips layers that are not on the map yet', () => {
    const map = createMapRecorder(['a']);

    setLayersVisibility(map, ['missing', 'a'], true);

    expect(map.getLayer).toHaveBeenCalledTimes(2);
    expect(map.setLayoutProperty.mock.calls).toEqual([['a', 'visibility', 'visible']]);
  });

  it('does nothing for an empty list', () => {
    const map = createMapRecorder([]);

    setLayersVisibility(map, [], true);

    expect(map.getLayer).not.toHaveBeenCalled();
    expect(map.setLayoutProperty).not.toHaveBeenCalled();
  });
});
