import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MARKER_FILTER, mapMarkerFilter } from '@/lib/state/mapMarkerFilter.svelte.js';
import { errorToast } from '@/store/ui/errorToast';
import { EDIT_MODE_CONFIG } from '@/views/Map/MapConstants';
import { createCustomPointsEditor } from './MapCustomPointsEditor.svelte.js';

// The saved points (customPointsState.test.js covers the real state)
vi.mock('@/lib/state/customPointsState.svelte.js', () => {
  const points = [];
  return {
    customPointsState: {
      points,
      getById: (id) => points.find((point) => point.id === id) ?? null,
      add: vi.fn((data) => {
        const point = { ...data };
        points.push(point);
        return point;
      }),
      update: vi.fn((id, data) => Object.assign(points.find((point) => point.id === id) ?? {}, data)),
      remove: vi.fn((id) =>
        points.splice(
          points.findIndex((point) => point.id === id),
          1,
        ),
      ),
    },
  };
});

vi.mock('@/store/ui/errorToast', () => ({ errorToast: { warn: vi.fn() } }));

import { customPointsState } from '@/lib/state/customPointsState.svelte.js';

const i18n = { t: (key) => key };
let session;
let editor;

// A builder that knows the points added to it, and can be told to reject the next call
function createCustomPointsBuilder() {
  const known = new Set();
  return {
    addPoint: vi.fn((point) => (known.has(point.id) ? null : (known.add(point.id), { ...point }))),
    updatePoint: vi.fn((point) => (known.has(point.id) ? { ...point } : null)),
    removePoint: vi.fn((id) => known.delete(id)),
    getPointIdAt: vi.fn(() => null),
    known,
  };
}

const tap = (lng = 69.24, lat = 41.3) => ({ point: { x: 10, y: 20 }, lngLat: { lng, lat } });
const form = (data = {}) => ({ title: 'Home', description: 'Text', photos: [], pointId: 'p1', ...data });

function addSavedPoint(id = 'p1') {
  customPointsState.points.push({ id, coords: { lng: 1, lat: 2 }, title: 'Saved', photos: [] });
  session.customPointsBuilder.known.add(id);
}

beforeEach(() => {
  customPointsState.points.length = 0;
  [customPointsState.add, customPointsState.update, customPointsState.remove, errorToast.warn].forEach((fn) =>
    fn.mockClear(),
  );
  mapMarkerFilter.select(MARKER_FILTER.ALL);
  session = {
    builder: { isMarkerNear: vi.fn(() => false) },
    customPointsBuilder: createCustomPointsBuilder(),
    previews: { release: vi.fn() },
    showPreview: vi.fn(),
  };
  editor = createCustomPointsEditor({ session, i18n });
});

describe('a tap in the edit mode', () => {
  it('on an empty place opens the dialog for a new point there', () => {
    editor.handleMapClick(tap(5, 6));

    expect(editor.editMode.modalDialogState).toBe(true);
    expect(editor.editMode.coordinates).toEqual({ lng: 5, lat: 6 });
    expect(editor.editingPoint).toBeNull();
  });

  it('on a custom point opens that point', () => {
    addSavedPoint('p1');
    session.customPointsBuilder.getPointIdAt.mockReturnValueOnce('p1');

    editor.handleMapClick(tap());

    expect(editor.editMode.editingPointId).toBe('p1');
    expect(editor.editingPoint.title).toBe('Saved');
  });

  it('next to an article marker is refused with a warning', () => {
    session.builder.isMarkerNear.mockReturnValueOnce(true);

    editor.handleMapClick(tap());

    expect(session.builder.isMarkerNear).toHaveBeenCalledWith(
      { x: 10, y: 20 },
      EDIT_MODE_CONFIG.historicalMarkerGuardRadius,
    );
    expect(errorToast.warn).toHaveBeenCalledWith('errors:customPointNearHistorical');
    expect(editor.editMode.modalDialogState).toBe(false);
  });
});

describe('save', () => {
  it('a new point: on the map first, then in the state; the dialog closes; the cover follows', async () => {
    editor.handleMapClick(tap(5, 6));

    expect(editor.save(form())).toBe(true);

    expect(session.customPointsBuilder.addPoint).toHaveBeenCalledWith({
      id: 'p1',
      coords: { lng: 5, lat: 6 },
      title: 'Home',
      preview: '',
    });
    expect(customPointsState.add).toHaveBeenCalledWith({
      id: 'p1',
      coords: { lng: 5, lat: 6 },
      title: 'Home',
      description: 'Text',
      photos: [],
    });
    expect(editor.editMode.modalDialogState).toBe(false);

    // The cover is resolved in the background by the session (MapSession.test.js)
    expect(session.showPreview).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', title: 'Home' }));
  });

  it('a new point the map rejects is not saved, and the dialog stays open', () => {
    editor.handleMapClick(tap());
    session.customPointsBuilder.addPoint.mockReturnValueOnce(null);

    expect(editor.save(form())).toBe(false);

    expect(customPointsState.add).not.toHaveBeenCalled();
    expect(editor.editMode.modalDialogState).toBe(true);
  });

  it('an opened point: updated on the map, then in the state with the title the map accepted', () => {
    addSavedPoint('p1');
    session.customPointsBuilder.getPointIdAt.mockReturnValueOnce('p1');
    editor.handleMapClick(tap());

    expect(editor.save(form({ title: 'New title' }))).toBe(true);

    expect(session.customPointsBuilder.updatePoint).toHaveBeenCalledWith({ id: 'p1', title: 'New title' });
    expect(customPointsState.update).toHaveBeenCalledWith('p1', {
      title: 'New title',
      description: 'Text',
      photos: [],
    });
    expect(session.showPreview).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', title: 'New title' }));
  });

  it('an opened point the map rejects stays as it was', () => {
    addSavedPoint('p1');
    session.customPointsBuilder.getPointIdAt.mockReturnValueOnce('p1');
    editor.handleMapClick(tap());
    session.customPointsBuilder.updatePoint.mockReturnValueOnce(null);

    expect(editor.save(form())).toBe(false);
    expect(customPointsState.update).not.toHaveBeenCalled();
  });

  it('once the map is gone nothing is saved', () => {
    editor.handleMapClick(tap());
    session.customPointsBuilder = null;

    expect(editor.save(form())).toBe(false);
    expect(customPointsState.add).not.toHaveBeenCalled();
  });
});

describe('remove', () => {
  function openSavedPoint(id) {
    addSavedPoint(id);
    session.customPointsBuilder.getPointIdAt.mockReturnValueOnce(id);
    editor.handleMapClick(tap());
  }

  it('removes the opened point from the map, the state and its preview; the dialog closes', () => {
    addSavedPoint('other');
    openSavedPoint('p1');

    expect(editor.remove()).toBe(true);

    expect(session.customPointsBuilder.removePoint).toHaveBeenCalledWith('p1');
    expect(customPointsState.remove).toHaveBeenCalledWith('p1');
    expect(session.previews.release).toHaveBeenCalledWith('p1');
    expect(editor.editMode.modalDialogState).toBe(false);
  });

  it('the last point puts the markers filter back to all', () => {
    mapMarkerFilter.select(MARKER_FILTER.CUSTOM);
    openSavedPoint('p1');

    editor.remove();

    expect(mapMarkerFilter.selected).toBe(MARKER_FILTER.ALL);
  });

  it('keeps the filter while other points remain', () => {
    addSavedPoint('other');
    mapMarkerFilter.select(MARKER_FILTER.CUSTOM);
    openSavedPoint('p1');

    editor.remove();

    expect(mapMarkerFilter.selected).toBe(MARKER_FILTER.CUSTOM);
  });

  it('a point the map does not know stays in the state', () => {
    openSavedPoint('p1');
    session.customPointsBuilder.removePoint.mockReturnValueOnce(false);

    expect(editor.remove()).toBe(false);
    expect(customPointsState.remove).not.toHaveBeenCalled();
  });

  it('with no point opened there is nothing to remove', () => {
    editor.handleMapClick(tap());

    expect(editor.remove()).toBe(false);
    expect(session.customPointsBuilder.removePoint).not.toHaveBeenCalled();
  });
});
