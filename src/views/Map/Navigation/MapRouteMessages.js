/**
 * MapRouteMessages Module
 *
 * The routing toasts both navigation controllers show — the engine failed to load, no route
 * between two places, the calculation crashed. Each controller gets its own instance under its
 * own scope, so a toast still says which mode failed.
 *
 * @example
 * const routeMessages = createRouteMessages({ i18n, scope: 'MapNavigation' });
 *
 * const result = findRoute(fromLon, fromLat, toLon, toLat);
 * if (!result.success) routeMessages.routeNotFound();
 */

import { errorToast } from '@/store/ui/errorToast';
import { ERROR_CODES } from '@/lib/errors/errorCodes';

/**
 * Create the routing toasts of one navigation controller.
 *
 * @param {Object} params - Dependencies
 * @param {{ t: (key: string) => string }} params.i18n - i18n instance for the toast texts
 * @param {string} params.scope - the controller's name, shown in the toast
 * @returns {{ engineInitFailed: () => void, routeNotFound: () => void, routeCalculationFailed: () => void }}
 *   one function per toast; each shows it every time it's called (errorToast dedups repeats)
 */
export function createRouteMessages({ i18n, scope }) {
  function engineInitFailed() {
    errorToast.error(i18n.t('errors:navigationInitFailed'), { scope, code: ERROR_CODES.NAV_INIT });
  }

  function routeNotFound() {
    errorToast.error(i18n.t('errors:navigationRouteNotFound'), { scope, code: ERROR_CODES.NAV_ROUTE_NOT_FOUND });
  }

  function routeCalculationFailed() {
    errorToast.error(i18n.t('errors:navigationCalculateRouteFailed'), { scope, code: ERROR_CODES.NAV_ROUTE_CALC });
  }

  return { engineInitFailed, routeNotFound, routeCalculationFailed };
}
