import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { AndroidSettings, IOSSettings, NativeSettings } from 'capacitor-native-settings';
import { ERROR_CODES } from '@/lib/errors/errorCodes';
import {
  checkLocationPermission,
  checkLocationReadiness,
  isLocationServicesEnabled,
  mapGeolocationError,
  openAppSettings,
  openLocationSettings,
  requestLocationPermission,
} from '@/capacitor/services/locationPermission';

// Permissions and positions need a device: both plugins are recorders the tests drive
vi.mock('@capacitor/geolocation', () => ({
  Geolocation: { checkPermissions: vi.fn(), requestPermissions: vi.fn(), getCurrentPosition: vi.fn() },
}));

vi.mock('capacitor-native-settings', async (importOriginal) => {
  const actual = await importOriginal();

  return { ...actual, NativeSettings: { open: vi.fn() } };
});

// The plugin's own errors: hyphenated codes, messages from its README
const pluginError = (code, message) => Object.assign(new Error(message), { code });

beforeEach(() => {
  // vi.fn()s created inside vi.mock are not reset by restoreMocks
  Object.values(Geolocation).forEach((fn) => fn.mockReset());
  NativeSettings.open.mockReset();
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
});

describe('checkLocationPermission', () => {
  it.each([
    ['granted', { isGranted: true, canRequest: false, needsSettings: false }],
    ['prompt', { isGranted: false, canRequest: true, needsSettings: false }],
    ['denied', { isGranted: false, canRequest: false, needsSettings: true }],
  ])('%s', async (status, flags) => {
    Geolocation.checkPermissions.mockResolvedValueOnce({ location: status });

    expect(await checkLocationPermission()).toEqual({ status, ...flags });
  });

  it('a failed check is treated as denied (send the user to the settings)', async () => {
    const error = new Error('bridge down');
    Geolocation.checkPermissions.mockRejectedValueOnce(error);

    expect(await checkLocationPermission()).toMatchObject({ status: 'denied', needsSettings: true, error });
  });
});

describe('requestLocationPermission', () => {
  it('granted: success and onSuccess', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    Geolocation.requestPermissions.mockResolvedValueOnce({ location: 'granted' });

    const result = await requestLocationPermission({ onSuccess, onError });

    expect(result).toMatchObject({ success: true, status: 'granted' });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('denied: onDenied and onError with the permission code', async () => {
    const onDenied = vi.fn();
    const onError = vi.fn();
    Geolocation.requestPermissions.mockResolvedValueOnce({ location: 'denied' });

    const result = await requestLocationPermission({ onDenied, onError });

    expect(result).toMatchObject({ success: false, status: 'denied', errorCode: ERROR_CODES.OS_PLUG_GLOC_0003 });
    expect(onDenied).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: ERROR_CODES.OS_PLUG_GLOC_0003 }));
  });

  it('still prompt (dismissed): not a success, but not denied either', async () => {
    const onDenied = vi.fn();
    Geolocation.requestPermissions.mockResolvedValueOnce({ location: 'prompt' });

    const result = await requestLocationPermission({ onDenied });

    expect(result).toMatchObject({ success: false, status: 'prompt' });
    expect(onDenied).not.toHaveBeenCalled();
  });

  it('a plugin error is mapped and reported', async () => {
    const onError = vi.fn();
    const error = Object.assign(new Error('User denied'), { code: 1 });
    Geolocation.requestPermissions.mockRejectedValueOnce(error);

    const result = await requestLocationPermission({ onError });

    expect(result).toMatchObject({ success: false, status: 'denied', errorCode: ERROR_CODES.OS_PLUG_GLOC_0003, error });
    expect(onError).toHaveBeenCalledWith({ code: ERROR_CODES.OS_PLUG_GLOC_0003, message: 'User denied', error });
  });

  it('works without callbacks', async () => {
    Geolocation.requestPermissions.mockResolvedValueOnce({ location: 'denied' });

    await expect(requestLocationPermission()).resolves.toMatchObject({ success: false });
  });

  it('on the web: never asks the plugin, reports the platform', async () => {
    Capacitor.isNativePlatform.mockReturnValue(false);
    const onError = vi.fn();

    const result = await requestLocationPermission({ onError });

    expect(Geolocation.requestPermissions).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: false, errorCode: ERROR_CODES.WEB_PLATFORM_NOT_SUPPORTED });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: ERROR_CODES.WEB_PLATFORM_NOT_SUPPORTED }));
  });
});

describe('openAppSettings / openLocationSettings', () => {
  it('opens the app details', async () => {
    expect(await openAppSettings()).toBe(true);
    expect(NativeSettings.open).toHaveBeenCalledWith({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });
  });

  it('opens the location settings', async () => {
    expect(await openLocationSettings()).toBe(true);
    expect(NativeSettings.open).toHaveBeenCalledWith({
      optionAndroid: AndroidSettings.Location,
      optionIOS: IOSSettings.LocationServices,
    });
  });

  it('report false when the settings could not be opened', async () => {
    NativeSettings.open.mockRejectedValue(new Error('no activity'));

    expect(await openAppSettings()).toBe(false);
    expect(await openLocationSettings()).toBe(false);
  });
});

describe('mapGeolocationError', () => {
  it('keeps a code that is already an app code', () => {
    expect(mapGeolocationError({ code: ERROR_CODES.OS_PLUG_GLOC_0009 })).toBe(ERROR_CODES.OS_PLUG_GLOC_0009);
  });

  it.each([
    [1, ERROR_CODES.OS_PLUG_GLOC_0003],
    [2, ERROR_CODES.OS_PLUG_GLOC_0002],
    [3, ERROR_CODES.OS_PLUG_GLOC_0010],
    [99, ERROR_CODES.OS_PLUG_GLOC_0002],
  ])('maps the web GeolocationPositionError code %i', (code, expected) => {
    expect(mapGeolocationError({ code })).toBe(expected);
  });

  it.each([
    ['Location services are disabled', ERROR_CODES.OS_PLUG_GLOC_0007],
    ['User denied the permission', ERROR_CODES.OS_PLUG_GLOC_0003],
    ['Timeout expired', ERROR_CODES.OS_PLUG_GLOC_0010],
    ['Location unavailable', ERROR_CODES.OS_PLUG_GLOC_0002],
    ['Something else', ERROR_CODES.OS_PLUG_GLOC_0002],
  ])('maps by message: "%s"', (message, expected) => {
    expect(mapGeolocationError({ message })).toBe(expected);
  });

  it('anything without a code or a message is a generic error', () => {
    expect(mapGeolocationError({})).toBe(ERROR_CODES.OS_PLUG_GLOC_0002);
  });

  // The plugin's codes are hyphenated ('OS-PLUG-GLOC-0007'), the app's are underscored
  it('maps the native plugin code OS-PLUG-GLOC-0007', () => {
    expect(mapGeolocationError(pluginError('OS-PLUG-GLOC-0007', 'Location services are not enabled.'))).toBe(
      ERROR_CODES.OS_PLUG_GLOC_0007,
    );
  });

  it('maps the native code even when its message would say otherwise', () => {
    expect(mapGeolocationError(pluginError('OS-PLUG-GLOC-0017', 'Unrelated text'))).toBe(ERROR_CODES.OS_PLUG_GLOC_0017);
  });

  // 0018 (permissions not declared in the manifest) is not in ERROR_CODES and has no translation
  it('an unknown native code falls back to the message rules, not passed through', () => {
    expect(mapGeolocationError(pluginError('OS-PLUG-GLOC-0018', 'Location permissions are not declared'))).toBe(
      ERROR_CODES.OS_PLUG_GLOC_0003,
    );
    expect(mapGeolocationError(pluginError('OS-PLUG-GLOC-0018', 'Something else'))).toBe(ERROR_CODES.OS_PLUG_GLOC_0002);
  });

  it('an unknown app-style code is not passed through either', () => {
    expect(mapGeolocationError({ code: 'OS_PLUG_GLOC_9999' })).toBe(ERROR_CODES.OS_PLUG_GLOC_0002);
  });

  it("another plugin's code is not taken for a geolocation one", () => {
    expect(mapGeolocationError({ code: ERROR_CODES.OS_PLUG_FILE_0008 })).toBe(ERROR_CODES.OS_PLUG_GLOC_0002);
  });

  it('maps the native timeout by its code', () => {
    expect(
      mapGeolocationError(
        pluginError('OS-PLUG-GLOC-0010', 'Could not obtain location in time. Try with a higher timeout.'),
      ),
    ).toBe(ERROR_CODES.OS_PLUG_GLOC_0010);
  });
});

describe('isLocationServicesEnabled', () => {
  it('a position means the services are on', async () => {
    Geolocation.getCurrentPosition.mockResolvedValueOnce({ coords: {} });

    expect(await isLocationServicesEnabled()).toBe(true);
  });

  it('a "services disabled" error means off', async () => {
    Geolocation.getCurrentPosition.mockRejectedValueOnce(new Error('Location services are disabled'));

    expect(await isLocationServicesEnabled()).toBe(false);
  });

  it('a timeout does not mean off', async () => {
    Geolocation.getCurrentPosition.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 3 }));

    expect(await isLocationServicesEnabled()).toBe(true);
  });

  it('the native "services not enabled" error means off', async () => {
    Geolocation.getCurrentPosition.mockRejectedValueOnce(
      pluginError('OS-PLUG-GLOC-0007', 'Location services are not enabled.'),
    );

    expect(await isLocationServicesEnabled()).toBe(false);
  });

  it('the native "network and location off" error means off', async () => {
    Geolocation.getCurrentPosition.mockRejectedValueOnce(pluginError('OS-PLUG-GLOC-0017', 'Both turned off'));

    expect(await isLocationServicesEnabled()).toBe(false);
  });
});

describe('checkLocationReadiness', () => {
  it('no permission: not ready, the services are not even checked', async () => {
    Geolocation.checkPermissions.mockResolvedValueOnce({ location: 'denied' });

    expect(await checkLocationReadiness()).toMatchObject({ ready: false, issue: 'permission', servicesEnabled: null });
    expect(Geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('permission but services off: not ready', async () => {
    Geolocation.checkPermissions.mockResolvedValueOnce({ location: 'granted' });
    Geolocation.getCurrentPosition.mockRejectedValueOnce(new Error('Location services are disabled'));

    expect(await checkLocationReadiness()).toMatchObject({ ready: false, issue: 'services', servicesEnabled: false });
  });

  it('both: ready', async () => {
    Geolocation.checkPermissions.mockResolvedValueOnce({ location: 'granted' });
    Geolocation.getCurrentPosition.mockResolvedValueOnce({ coords: {} });

    expect(await checkLocationReadiness()).toMatchObject({ ready: true, issue: null, servicesEnabled: true });
  });
});
