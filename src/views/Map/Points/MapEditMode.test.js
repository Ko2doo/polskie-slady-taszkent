import { describe, it, expect } from 'vitest';
import { createEditModeController } from './MapEditMode.svelte.js';

describe('createEditModeController', () => {
  it('starts with no point and a closed dialog', () => {
    const editMode = createEditModeController();

    expect(editMode.coordinates).toBeNull();
    expect(editMode.editingPointId).toBeNull();
    expect(editMode.modalDialogState).toBe(false);
  });

  it('a map click starts a new point at the clicked place', () => {
    const editMode = createEditModeController();

    editMode.handleMapClick({ lngLat: { lng: 69.24, lat: 41.3, extra: true } });

    expect(editMode.coordinates).toEqual({ lng: 69.24, lat: 41.3 });
    expect(editMode.editingPointId).toBeNull();
    expect(editMode.modalDialogState).toBe(true);
  });

  it('editing an existing point opens it with its own coordinates', () => {
    const editMode = createEditModeController();

    editMode.startEditing({ id: 'p1', coords: { lng: 1, lat: 2 } });

    expect(editMode.coordinates).toEqual({ lng: 1, lat: 2 });
    expect(editMode.editingPointId).toBe('p1');
    expect(editMode.modalDialogState).toBe(true);
  });

  // The dialog keeps its texts during the closing animation
  it('closing keeps the point; the next map click starts a new one', () => {
    const editMode = createEditModeController();
    editMode.startEditing({ id: 'p1', coords: { lng: 1, lat: 2 } });

    editMode.closeModal();
    expect(editMode.modalDialogState).toBe(false);
    expect(editMode.editingPointId).toBe('p1');

    editMode.handleMapClick({ lngLat: { lng: 3, lat: 4 } });
    expect(editMode.editingPointId).toBeNull();
  });

  it('controllers are independent', () => {
    const first = createEditModeController();
    const second = createEditModeController();

    first.openModal();

    expect(second.modalDialogState).toBe(false);
  });
});
