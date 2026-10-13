// import * as mapllibreGl from 'maplibre-gl';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const mapEditModeLogger = createLogger('MapEditMode');

export function createEditModeController() {
  let coordinates = $state(null);
  let modalDialogState = $state(false);

  function handleMapClick(e) {
    const { lng, lat } = e.lngLat;
    coordinates = { lng, lat };

    if (!coordinates) return;

    openModal();

    IS_DEBUG &&
      mapEditModeLogger.log('Point coordinates:', {
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      });
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

    handleMapClick,
    openModal,
    closeModal,
  };
}
