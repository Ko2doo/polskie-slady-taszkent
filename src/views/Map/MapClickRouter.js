/**
 * The map modes that can take a tap on the map, as returned by routeMapClick
 */
export const CLICK_MODE = {
  GPS: 'gps',
  NAVIGATION: 'navigation',
  EDIT: 'edit',
};

/**
 * Hands a map tap to the one mode that takes it, by priority: GPS navigation (only once it's
 * ready — it needs the permission and the tracker first), then point-to-point navigation (it
 * initializes on its first tap, so no ready check), then the custom-points edit mode. With no
 * mode on, the tap is ignored.
 * @param {Object} event - MapLibre click event
 * @param {Object} modes - the screen's current modes; any of them may still be null
 * @param {{ gpsMode: boolean, gpsReady: boolean, handleMapClick: Function }|null} modes.gpsNavigation
 * @param {{ navigationMode: boolean, handleMapClick: Function }|null} modes.navigation
 * @param {{ handleMapClick: Function }|null} modes.pointsEditor
 * @param {boolean} modes.isEditing - the edit mode is on
 * @returns {string|null} the CLICK_MODE that took the tap, null when none did
 * @example
 * map.on('click', (event) => {
 *   routeMapClick(event, { gpsNavigation, navigation, pointsEditor, isEditing: editToggle.value });
 * });
 */
export function routeMapClick(event, { gpsNavigation, navigation, pointsEditor, isEditing }) {
  if (gpsNavigation?.gpsMode && gpsNavigation.gpsReady) {
    gpsNavigation.handleMapClick(event);
    return CLICK_MODE.GPS;
  }

  if (navigation?.navigationMode) {
    navigation.handleMapClick(event);
    return CLICK_MODE.NAVIGATION;
  }

  if (isEditing && pointsEditor) {
    pointsEditor.handleMapClick(event);
    return CLICK_MODE.EDIT;
  }

  return null;
}
