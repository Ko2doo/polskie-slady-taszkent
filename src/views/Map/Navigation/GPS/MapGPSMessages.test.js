import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import { errorToast } from '@/store/ui/errorToast';
import { openAppSettings, openLocationSettings } from '@/capacitor/services/locationPermission';
import { createGPSMessages } from './MapGPSMessages';

vi.mock('@/store/ui/errorToast', () => ({ errorToast: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/capacitor/services/locationPermission', () => ({
  openAppSettings: vi.fn(),
  openLocationSettings: vi.fn(),
}));

const i18n = { t: (key) => key };

let messages;

beforeEach(() => {
  // vi.fn()s created inside vi.mock are not reset by restoreMocks
  Object.values(errorToast).forEach((fn) => fn.mockReset());
  openAppSettings.mockReset();
  openLocationSettings.mockReset();
  messages = createGPSMessages({ i18n });
});

describe('GPS errors', () => {
  it('a geolocation code is shown with its own text, once', () => {
    messages.gpsError({ code: ERROR_CODES.OS_PLUG_GLOC_0002 });
    messages.gpsError({ code: ERROR_CODES.OS_PLUG_GLOC_0002 });

    expect(errorToast.error).toHaveBeenCalledTimes(1);
    expect(errorToast.error).toHaveBeenCalledWith(`errors:${ERROR_CODES.OS_PLUG_GLOC_0002}`, {
      scope: 'GPSNavigation',
      code: ERROR_CODES.OS_PLUG_GLOC_0002,
    });
  });

  it('different codes are each shown', () => {
    messages.gpsError({ code: ERROR_CODES.OS_PLUG_GLOC_0002 });
    messages.gpsError({ code: ERROR_CODES.OS_PLUG_GLOC_0007 });

    expect(errorToast.error).toHaveBeenCalledTimes(2);
  });

  it('after forgetShownErrors the same code is shown again', () => {
    messages.gpsError({ code: ERROR_CODES.OS_PLUG_GLOC_0002 });
    messages.forgetShownErrors();
    messages.gpsError({ code: ERROR_CODES.OS_PLUG_GLOC_0002 });

    expect(errorToast.error).toHaveBeenCalledTimes(2);
  });

  it('a denied permission offers the app settings', async () => {
    messages.gpsError({ code: ERROR_CODES.OS_PLUG_GLOC_0003 });

    const { action } = errorToast.error.mock.lastCall[1];
    expect(action).toMatchObject({ type: 'openSettings', label: 'ui:buttons:openSettings' });

    await action.handler();
    expect(openAppSettings).toHaveBeenCalledTimes(1);
    expect(openLocationSettings).not.toHaveBeenCalled();
  });

  it('location turned off offers the location settings', async () => {
    messages.gpsError({ code: ERROR_CODES.OS_PLUG_GLOC_0017 });

    await errorToast.error.mock.lastCall[1].action.handler();
    expect(openLocationSettings).toHaveBeenCalledTimes(1);
    expect(openAppSettings).not.toHaveBeenCalled();
  });

  it('other geolocation codes offer no action', () => {
    messages.gpsError({ code: ERROR_CODES.OS_PLUG_GLOC_0007 });

    expect(errorToast.error.mock.lastCall[1]).not.toHaveProperty('action');
  });

  it('a timeout is the "waiting for signal" note, never an error, and does not block itself', () => {
    messages.gpsError({ code: ERROR_CODES.OS_PLUG_GLOC_0010 });
    messages.forgetWaitingForFix();
    messages.gpsError({ code: ERROR_CODES.OS_PLUG_GLOC_0010 });

    expect(errorToast.info).toHaveBeenCalledTimes(2);
    expect(errorToast.error).not.toHaveBeenCalled();
  });

  it('an unknown code or none at all gets the generic message', () => {
    messages.gpsError({ code: 'SOMETHING' });
    messages.gpsError({});

    expect(errorToast.error).toHaveBeenCalledWith('errors:gpsError', { scope: 'GPSNavigation', code: 'SOMETHING' });
    expect(errorToast.error).toHaveBeenCalledWith('errors:gpsError', {
      scope: 'GPSNavigation',
      code: ERROR_CODES.GPS_ERROR,
    });
  });

  it('an error without a code is shown once too', () => {
    messages.gpsError({});
    messages.gpsError({});

    expect(errorToast.error).toHaveBeenCalledTimes(1);
  });
});

describe('waiting for a GPS fix', () => {
  it('is shown once', () => {
    messages.waitingForFix();
    messages.waitingForFix();

    expect(errorToast.info).toHaveBeenCalledTimes(1);
    expect(errorToast.info).toHaveBeenCalledWith('errors:gpsWaitingForSignal', {
      scope: 'GPSNavigation',
      code: ERROR_CODES.GPS_WAITING_FOR_FIX,
    });
  });

  it('is shown again after forgetWaitingForFix', () => {
    messages.waitingForFix();
    messages.forgetWaitingForFix();
    messages.waitingForFix();

    expect(errorToast.info).toHaveBeenCalledTimes(2);
  });

  it('forgetting shown errors does not repeat it', () => {
    messages.waitingForFix();
    messages.forgetShownErrors();
    messages.waitingForFix();

    expect(errorToast.info).toHaveBeenCalledTimes(1);
  });
});

describe('one-off messages', () => {
  it.each([
    ['outOfBounds', 'warn', 'errors:gpsOutOfBounds', ERROR_CODES.GPS_OUT_OF_BOUNDS],
    ['outOfBoundsNavigation', 'warn', 'errors:gpsOutOfBoundsNavigation', ERROR_CODES.GPS_OUT_OF_BOUNDS_NAVIGATION],
    ['initFailed', 'error', 'errors:gpsInitFailed', ERROR_CODES.NAV_INIT],
    ['routeNotFound', 'error', 'errors:navigationRouteNotFound', ERROR_CODES.NAV_ROUTE_NOT_FOUND],
    ['routeCalculationFailed', 'error', 'errors:navigationCalculateRouteFailed', ERROR_CODES.NAV_ROUTE_CALC],
  ])('%s: a %s toast with its text and code, every time', (method, level, text, code) => {
    messages[method]();
    messages[method]();

    expect(errorToast[level]).toHaveBeenCalledTimes(2);
    expect(errorToast[level]).toHaveBeenCalledWith(text, { scope: 'GPSNavigation', code });
  });

  it('backInBounds: an info toast without a code', () => {
    messages.backInBounds();

    expect(errorToast.info).toHaveBeenCalledWith('ui:map:gps:backInBounds', { scope: 'GPSNavigation' });
  });
});
