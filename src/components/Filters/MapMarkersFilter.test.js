import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { i18nStub } from '@/test/i18nStub';
import MapMarkersFilter from '@/components/Filters/MapMarkersFilter.svelte';

// The filter state is a recorder (mapMarkerFilter.test.js covers the real one)
const filter = vi.hoisted(() => ({ selected: 'all' }));
vi.mock('@/lib/state/mapMarkerFilter.svelte', async (importOriginal) => {
  const { MARKER_FILTER } = await importOriginal();
  return {
    MARKER_FILTER,
    mapMarkerFilter: {
      get selected() {
        return filter.selected;
      },
      select: vi.fn((id) => (filter.selected = id)),
    },
  };
});

import { mapMarkerFilter } from '@/lib/state/mapMarkerFilter.svelte';

let target;
let component;

const radios = () => [...target.querySelectorAll('input[type="radio"]')];

beforeEach(() => {
  filter.selected = 'custom';
  mapMarkerFilter.select.mockClear();
  target = document.createElement('div');
  document.body.append(target);
  component = mount(MapMarkersFilter, { target, props: { i18n: i18nStub } });
  flushSync();
});

afterEach(() => {
  unmount(component);
  target.remove();
});

describe('MapMarkersFilter', () => {
  it('offers all / custom / historical, with the current one checked', () => {
    expect(radios()).toHaveLength(3);
    expect(radios().map((radio) => radio.checked)).toEqual([false, true, false]);
  });

  it('picking one selects it', () => {
    radios()[2].click();

    expect(mapMarkerFilter.select).toHaveBeenCalledWith('historical');
  });
});
