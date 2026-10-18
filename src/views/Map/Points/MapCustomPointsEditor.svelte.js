import { customPointsState } from '@/lib/state/customPointsState.svelte.js';
import { MARKER_FILTER, mapMarkerFilter } from '@/lib/state/mapMarkerFilter.svelte.js';
import { errorToast } from '@/store/ui/errorToast';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';
import { EDIT_MODE_CONFIG } from '@/views/Map/MapConstants.js';
import { createEditModeController } from './MapEditMode.svelte.js';

const editorLogger = createLogger('MapCustomPointsEditor');

/**
 * The map screen's custom-point editing: what a tap in the edit mode does, and saving or deleting
 * the point opened in the editor dialog. It keeps the map and the points state in step — the map
 * goes first everywhere: if the builder rejects a point, the state (and the point's photos) stay
 * untouched. Owns the edit mode's own state (`editMode`, see MapEditMode.svelte.js).
 *
 * Create it once the map session has started: it reads the builders and the preview tracker from
 * the session each time, so it never holds on to a released map.
 *
 * @param {Object} options - what the editor works with
 * @param {{ builder: Object|null, customPointsBuilder: Object|null, showPreview: (point: Object) => Promise<void>,
 *   previews: ReturnType<typeof import('./MapPreview.js').createPreviewTracker> }} options.session -
 *   the started map session (MapSession.svelte.js); a saved point's cover goes through its showPreview
 * @param {Object} options.i18n - the i18next instance (`$i18n`), for the warning toast
 * @returns {{ editMode: ReturnType<typeof createEditModeController>, readonly editingPoint: Object|null,
 *   handleMapClick: (event: Object) => void, save: (formData: Object) => boolean, remove: () => boolean }}
 *   `editingPoint` is reactive: the point open in the dialog, null while a new one is created
 * @example
 * const editor = createCustomPointsEditor({ session, i18n: $i18n });
 *
 * map.on('click', (event) => editor.handleMapClick(event)); // while the edit mode is on
 * // <CustomPointsMapEditorDialog onSave={editor.save} onDelete={editor.remove} ... />
 */
export function createCustomPointsEditor({ session, i18n }) {
  const editMode = createEditModeController();

  const editingPoint = $derived(editMode.editingPointId ? customPointsState.getById(editMode.editingPointId) : null);

  /**
   * A tap in the edit mode: on a custom point it opens that point, on an empty place it starts a
   * new one; next to an article marker it's refused with a warning (those markers are hidden in
   * the edit mode, so their places are protected from an accidental new point)
   * @param {Object} event - MapLibre click event
   */
  function handleMapClick(event) {
    const { builder, customPointsBuilder } = session;
    const pointId = customPointsBuilder ? customPointsBuilder.getPointIdAt(event.point) : null;
    const point = pointId ? customPointsState.getById(pointId) : null;

    if (point) {
      editMode.startEditing(point);
      return;
    }

    if (builder && builder.isMarkerNear(event.point, EDIT_MODE_CONFIG.historicalMarkerGuardRadius)) {
      IS_DEBUG && editorLogger.log('Click ignored: too close to a historical marker');

      errorToast.warn(i18n.t('errors:customPointNearHistorical'));
      return;
    }

    editMode.handleMapClick(event);
  }

  function createPoint(formData) {
    if (!editMode.coordinates) return false;

    // The id was created when the form opened: the point's photos already live in its folder
    const renderedPoint = session.customPointsBuilder.addPoint({
      id: formData.pointId,
      coords: editMode.coordinates,
      title: formData.title,
      preview: '',
    });

    if (!renderedPoint) return false;

    const point = customPointsState.add({
      id: formData.pointId,
      coords: editMode.coordinates,
      title: formData.title,
      description: formData.description,
      photos: formData.photos,
    });

    session.showPreview(point);

    editMode.closeModal();
    return true;
  }

  function updatePoint(id, formData) {
    const renderedPoint = session.customPointsBuilder.updatePoint({ id, title: formData.title });

    if (!renderedPoint) return false;

    const point = customPointsState.update(id, {
      title: renderedPoint.title,
      description: formData.description,
      photos: formData.photos,
    });

    if (point) session.showPreview(point);

    editMode.closeModal();
    return true;
  }

  /**
   * Saves the editor dialog: updates the opened point, or creates a new one at the tapped place.
   * @param {{ title: string, description: string, photos: string[], pointId: string }} formData -
   *   the dialog's form
   * @returns {boolean} true if the point was saved and is on the map; the dialog stays open if not
   */
  function save(formData) {
    if (!session.customPointsBuilder) return false;

    if (editMode.editingPointId) return updatePoint(editMode.editingPointId, formData);

    return createPoint(formData);
  }

  /**
   * Deletes the point opened in the editor dialog, from the map first.
   * @returns {boolean} true if the point was deleted
   */
  function remove() {
    const id = editMode.editingPointId;

    if (!session.customPointsBuilder || !id) return false;

    const isRemoved = session.customPointsBuilder.removePoint(id);

    if (!isRemoved) return false;

    customPointsState.remove(id);
    session.previews.release(id);

    // Without custom points the filter button disappears, so the filter must not stay on a mode
    // that hides markers
    if (customPointsState.points.length === 0) mapMarkerFilter.select(MARKER_FILTER.ALL);

    editMode.closeModal();
    return true;
  }

  return {
    editMode,
    get editingPoint() {
      return editingPoint;
    },
    handleMapClick,
    save,
    remove,
  };
}
