/**
 * MapGPSMessages Module
 *
 * Every toast GPS navigation shows the user, in one place: GPS errors (each code once), the
 * "waiting for a GPS signal" note (once per destination), leaving/re-entering the map area and
 * route failures. Its bookkeeping (which codes were shown) is plain closure state, not reactive —
 * nothing renders it (harness/performance.md → "Reactivity").
 *
 * @example
 * const messages = createGPSMessages({ i18n });
 *
 * tracker = createGPSTracker({ onPositionUpdate, onError: messages.gpsError });
 * messages.waitingForFix(); // shown
 * messages.waitingForFix(); // skipped until forgetWaitingForFix()
 * messages.forgetShownErrors(); // GPS mode switched off: the next session reports errors again
 */

import { errorToast } from '@/store/ui/errorToast';
import { ERROR_CODES, GEOLOCATION_CODE_PREFIX } from '@/lib/errors/errorCodes';
import { createRouteMessages } from '@/views/Map/Navigation/MapRouteMessages';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const gpsMessagesLogger = createLogger('GPSMessages');

const TOAST_SCOPE = 'GPSNavigation';

// Errors the user fixes in the system settings: the toast offers the right settings screen
// (an export of capacitor/services/locationPermission.js)
const SETTINGS_OPENER_BY_CODE = {
  [ERROR_CODES.OS_PLUG_GLOC_0003]: 'openAppSettings', // permission denied
  [ERROR_CODES.OS_PLUG_GLOC_0017]: 'openLocationSettings', // location turned off
};

/**
 * Create the GPS navigation's message channel — one per GPS navigation controller.
 *
 * @param {Object} params - Dependencies
 * @param {{ t: (key: string) => string }} params.i18n - i18n instance for the toast texts
 * @returns {{
 *   gpsError: (error: { code?: string }) => void,
 *   waitingForFix: () => void,
 *   forgetWaitingForFix: () => void,
 *   forgetShownErrors: () => void,
 *   outOfBounds: () => void,
 *   outOfBoundsNavigation: () => void,
 *   backInBounds: () => void,
 *   initFailed: () => void,
 *   routeNotFound: () => void,
 *   routeCalculationFailed: () => void,
 * }} `gpsError` takes the tracker's `onError` payload: a timeout is the "waiting for signal" note,
 * any other code is shown once until `forgetShownErrors()`.
 */
export function createGPSMessages({ i18n }) {
  // Error codes already shown since the last forgetShownErrors()
  const shownErrorCodes = new Set();
  const routeMessages = createRouteMessages({ i18n, scope: TOAST_SCOPE });
  let didShowWaitingForFix = false;

  function settingsAction(openerName) {
    return {
      type: 'openSettings',
      label: i18n.t('ui:buttons:openSettings'),
      handler: async () => {
        IS_DEBUG && gpsMessagesLogger.log('Opening settings:', openerName);
        const permission = await import('@/capacitor/services/locationPermission');
        await permission[openerName]();
      },
    };
  }

  function gpsError(error) {
    const errorCode = error.code;

    // A timeout only means there's no fix yet — not fatal, and it repeats while waiting
    if (errorCode === ERROR_CODES.OS_PLUG_GLOC_0010) {
      waitingForFix();
      return;
    }

    if (shownErrorCodes.has(errorCode)) {
      IS_DEBUG && gpsMessagesLogger.log('Error already shown, skipping:', errorCode);
      return;
    }
    shownErrorCodes.add(errorCode);

    if (!errorCode?.startsWith(GEOLOCATION_CODE_PREFIX)) {
      errorToast.error(i18n.t('errors:gpsError'), {
        scope: TOAST_SCOPE,
        code: errorCode || ERROR_CODES.GPS_ERROR,
      });
      return;
    }

    const openerName = SETTINGS_OPENER_BY_CODE[errorCode];
    errorToast.error(i18n.t(`errors:${errorCode}`), {
      scope: TOAST_SCOPE,
      code: errorCode,
      ...(openerName && { action: settingsAction(openerName) }),
    });
  }

  function waitingForFix() {
    if (didShowWaitingForFix) return;
    didShowWaitingForFix = true;

    errorToast.info(i18n.t('errors:gpsWaitingForSignal'), {
      scope: TOAST_SCOPE,
      code: ERROR_CODES.GPS_WAITING_FOR_FIX,
    });
  }

  function forgetWaitingForFix() {
    didShowWaitingForFix = false;
  }

  function forgetShownErrors() {
    shownErrorCodes.clear();
  }

  function outOfBounds() {
    errorToast.warn(i18n.t('errors:gpsOutOfBounds'), { scope: TOAST_SCOPE, code: ERROR_CODES.GPS_OUT_OF_BOUNDS });
  }

  function outOfBoundsNavigation() {
    errorToast.warn(i18n.t('errors:gpsOutOfBoundsNavigation'), {
      scope: TOAST_SCOPE,
      code: ERROR_CODES.GPS_OUT_OF_BOUNDS_NAVIGATION,
    });
  }

  function backInBounds() {
    errorToast.info(i18n.t('ui:map:gps:backInBounds'), { scope: TOAST_SCOPE });
  }

  function initFailed() {
    errorToast.error(i18n.t('errors:gpsInitFailed'), { scope: TOAST_SCOPE, code: ERROR_CODES.NAV_INIT });
  }

  return {
    gpsError,
    waitingForFix,
    forgetWaitingForFix,
    forgetShownErrors,
    outOfBounds,
    outOfBoundsNavigation,
    backInBounds,
    initFailed,
    // Shared with point-to-point navigation, under the GPS scope
    routeNotFound: routeMessages.routeNotFound,
    routeCalculationFailed: routeMessages.routeCalculationFailed,
  };
}
