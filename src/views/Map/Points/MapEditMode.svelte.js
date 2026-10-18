import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const mapEditModeLogger = createLogger('MapEditMode');

/**
 * The map screen's marker-editing state: the tapped coordinates, which point is being edited,
 * and whether the editor dialog is open. One controller per Map.svelte instance.
 * @returns {{ readonly coordinates: *, readonly modalDialogState: boolean,
 *   readonly editingPointId: string|null, handleMapClick: (event: *) => void,
 *   startEditing: (point: object) => void, openModal: () => void, closeModal: () => void }} the
 *   controller; the getters are reactive
 * @example
 * const editMode = createEditModeController();
 * map.on('click', (event) => editMode.handleMapClick(event));
 */
export function createEditModeController() {
  let coordinates = $state(null);
  let modalDialogState = $state(false);

  // Id of the custom point opened for editing, null while a new point is being created.
  // It is reset on the next map click (not on close), so the dialog keeps its texts during the closing animation.
  let editingPointId = $state(null);

  /**
   * Click on an empty place of the map: start creating a new point
   * @param {Object} e - MapLibre click event
   */
  function handleMapClick(e) {
    const { lng, lat } = e.lngLat;

    coordinates = { lng, lat };
    editingPointId = null;

    openModal();

    IS_DEBUG &&
      mapEditModeLogger.log('Point coordinates:', {
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      });
  }

  /**
   * Click on an existing custom point: open the dialog to update its data
   * @param {Object} point - Custom point from customPointsState
   */
  function startEditing(point) {
    coordinates = { lng: point.coords.lng, lat: point.coords.lat };
    editingPointId = point.id;

    openModal();

    IS_DEBUG && mapEditModeLogger.log('Editing point:', point.id);
  }

  function openModal() {
    modalDialogState = true;
  }

  function closeModal() {
    modalDialogState = false;
  }

  return {
    get coordinates() {
      return coordinates;
    },
    get modalDialogState() {
      return modalDialogState;
    },
    get editingPointId() {
      return editingPointId;
    },

    handleMapClick,
    startEditing,
    openModal,
    closeModal,
  };
}
