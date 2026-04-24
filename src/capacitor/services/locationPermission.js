/**
 * Location Permissions Service
 *
 * Universal module for working with geolocation permissions
 * Used both in onboarding (WelcomeDialog) and GPS tracker
 *
 * Features:
 * - Check current permission status
 * - Request permissions with handling of all possible statuses
 * - Open app settings to enable permissions
 * - Unified error handling with ERROR_CODES
 * - Callback support for integration in different parts of the app
 *
 * @module locationPermissions
 */

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { NativeSettings, AndroidSettings, IOSSettings } from 'capacitor-native-settings';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

import { ERROR_CODES } from '@/lib/errors/errorCodes';

const locationPermissionLogger = createLogger('LocationPermissions');

/**
 * Permission status types
 * @typedef {'granted' | 'denied' | 'prompt'} PermissionStatus
 */

/**
 * Permission check result
 * @typedef {Object} PermissionCheckResult
 * @property {PermissionStatus} status - Current permission status
 * @property {boolean} isGranted - Quick check: is it granted
 * @property {boolean} canRequest - Can we request permission (status 'prompt')
 * @property {boolean} needsSettings - Need to open settings (status 'denied')
 */

/**
 * Permission request result
 * @typedef {Object} PermissionRequestResult
 * @property {boolean} success - Successfully obtained permission
 * @property {PermissionStatus} status - Final status
 * @property {string} errorCode - Error code from ERROR_CODES (if not successful)
 * @property {string} message - Message for user
 * @property {Error} [error] - Error object (if occurred)
 */

/**
 * Permission request options
 * @typedef {Object} RequestPermissionOptions
 * @property {Function} [onSuccess] - Callback on successful permission grant
 * @property {Function} [onDenied] - Callback on user denial
 * @property {Function} [onError] - Callback on API error
 * @property {boolean} [silent] - Don't log to console (default false)
 */

/**
 * Checks current geolocation permission status
 *
 * @returns {Promise<PermissionCheckResult>}
 * @throws {Error} On critical API errors
 *
 * @example
 * const result = await checkLocationPermission();
 * if (result.isGranted) {
 *   // Can use geolocation
 * } else if (result.canRequest) {
 *   // Can show request dialog
 * } else if (result.needsSettings) {
 *   // Need to direct to settings
 * }
 */
export async function checkLocationPermission() {
  try {
    const permissions = await Geolocation.checkPermissions();
    const status = permissions.location;

    IS_DEBUG && locationPermissionLogger.log('Current status:', status);

    return {
      status,
      isGranted: status === 'granted',
      canRequest: status === 'prompt',
      needsSettings: status === 'denied',
    };
  } catch (error) {
    IS_DEBUG && locationPermissionLogger.error('Failed to check permissions:', error);

    // In case of check error, return safe state
    return {
      status: 'denied',
      isGranted: false,
      canRequest: false,
      needsSettings: true,
      error,
    };
  }
}

/**
 * Requests geolocation permission
 *
 * Handles all possible scenarios:
 * - User granted permission
 * - User denied permission (temporarily)
 * - User denied forever (denied)
 * - API error
 *
 * @param {RequestPermissionOptions} options - Request options
 * @returns {Promise<PermissionRequestResult>}
 *
 * @example
 * const result = await requestLocationPermission({
 *   onSuccess: () => IS_DEBUG && locationPermissionLogger.log('Granted!'),
 *   onDenied: () => showSettingsPrompt(),
 *   onError: (err) => showError(err)
 * });
 *
 * if (result.success) {
 *   // Start using geolocation
 * }
 */
export async function requestLocationPermission(options = {}) {
  const { onSuccess, onDenied, onError, silent = false } = options;

  if (!silent) {
    IS_DEBUG && locationPermissionLogger.log('Requesting permissions...');
  }

  // Check platform
  if (!Capacitor.isNativePlatform()) {
    const errorCode = ERROR_CODES.WEB_PLATFORM_NOT_SUPPORTED;
    const message = 'Geolocation permissions are only available on mobile devices';

    if (!silent) {
      IS_DEBUG && locationPermissionLogger.warn(message);
    }

    if (onError) {
      onError({ code: errorCode, message });
    }

    return {
      success: false,
      status: 'denied',
      errorCode,
      message,
    };
  }

  try {
    // Request permission
    const permissions = await Geolocation.requestPermissions();
    const status = permissions.location;

    if (!silent) {
      IS_DEBUG && locationPermissionLogger.log('Request result:', status);
    }

    // Handle result
    if (status === 'granted') {
      // Success
      if (onSuccess) {
        onSuccess();
      }

      return {
        success: true,
        status: 'granted',
        message: 'Geolocation permission granted',
      };
    } else if (status === 'denied') {
      // Denied
      const errorCode = ERROR_CODES.OS_PLUG_GLOC_0003;
      const message = 'Geolocation permission denied';

      if (onDenied) {
        onDenied();
      }

      if (onError) {
        onError({ code: errorCode, message });
      }

      return {
        success: false,
        status: 'denied',
        errorCode,
        message,
      };
    } else {
      // Prompt or unknown status
      const errorCode = ERROR_CODES.OS_PLUG_GLOC_0003;
      const message = 'Failed to obtain geolocation permission';

      if (onError) {
        onError({ code: errorCode, message });
      }

      return {
        success: false,
        status,
        errorCode,
        message,
      };
    }
  } catch (error) {
    // API error
    IS_DEBUG && locationPermissionLogger.error('Request failed:', error);

    const errorCode = mapGeolocationError(error);
    const message = error.message || 'Error requesting geolocation permission';

    if (onError) {
      onError({ code: errorCode, message, error });
    }

    return {
      success: false,
      status: 'denied',
      errorCode,
      message,
      error,
    };
  }
}

/**
 * Opens system app settings
 * Used when user denied permission forever
 *
 * @returns {Promise<boolean>} - true if successfully opened settings
 *
 * @example
 * const opened = await openAppSettings();
 * if (opened) {
 *   IS_DEBUG && locationPermissionLogger.log('Settings opened');
 * }
 */
export async function openAppSettings() {
  try {
    IS_DEBUG && locationPermissionLogger.log('Opening app settings...');

    await NativeSettings.open({
      optionAndroid: AndroidSettings.ApplicationDetails,
      optionIOS: IOSSettings.App,
    });

    return true;
  } catch (error) {
    IS_DEBUG && locationPermissionLogger.error('Failed to open settings:', error);
    return false;
  }
}

/**
 * Checks if location services are enabled on device
 * (not to be confused with app permissions!)
 *
 * @returns {Promise<boolean>} - true if services are enabled
 *
 * @example
 * const enabled = await isLocationServicesEnabled();
 * if (!enabled) {
 *   alert('Please enable GPS in device settings');
 * }
 */
export async function isLocationServicesEnabled() {
  try {
    // Try to get position with short timeout
    await Geolocation.getCurrentPosition({
      timeout: 1000,
      enableHighAccuracy: false,
    });

    return true;
  } catch (error) {
    // Analyze error
    const errorCode = mapGeolocationError(error);

    // If services are disabled
    if (errorCode === ERROR_CODES.OS_PLUG_GLOC_0007 || errorCode === ERROR_CODES.OS_PLUG_GLOC_0017) {
      return false;
    }

    // Timeout or other errors - assume services are enabled
    return true;
  }
}

/**
 * Opens location settings on device
 *
 * @returns {Promise<boolean>}
 *
 * @example
 * await openLocationSettings();
 */
export async function openLocationSettings() {
  try {
    IS_DEBUG && locationPermissionLogger.log('Opening location settings...');

    await NativeSettings.open({
      optionAndroid: AndroidSettings.Location,
      optionIOS: IOSSettings.LocationServices,
    });

    return true;
  } catch (error) {
    IS_DEBUG && locationPermissionLogger.error('Failed to open location settings:', error);
    return false;
  }
}

/**
 * Maps Capacitor Geolocation errors to ERROR_CODES
 * Reuses logic from gpsTracker.js
 *
 * @param {Object} error - Error object from Capacitor
 * @returns {string} - Error code from ERROR_CODES
 */
export function mapGeolocationError(error) {
  // If it's already our custom code
  if (error.code && typeof error.code === 'string' && error.code.startsWith('OS_PLUG_GLOC_')) {
    return error.code;
  }

  // Map Capacitor numeric error codes
  if (typeof error.code === 'number') {
    switch (error.code) {
      case 1:
        return ERROR_CODES.OS_PLUG_GLOC_0003; // PERMISSION_DENIED
      case 2:
        return ERROR_CODES.OS_PLUG_GLOC_0002; // POSITION_UNAVAILABLE
      case 3:
        return ERROR_CODES.OS_PLUG_GLOC_0010; // TIMEOUT
      default:
        return ERROR_CODES.OS_PLUG_GLOC_0002; // Generic error
    }
  }

  // Analyze error message
  if (error.message) {
    const msg = error.message.toLowerCase();

    // Priority 1: Location services disabled
    if ((msg.includes('location services') && msg.includes('disabled')) || msg.includes('off')) {
      return ERROR_CODES.OS_PLUG_GLOC_0007;
    }

    // Priority 2: Both network and location off
    if (msg.includes('location') && msg.includes('off')) {
      return ERROR_CODES.OS_PLUG_GLOC_0017;
    }

    // Priority 3: Permission denied
    if (msg.includes('permission') || msg.includes('denied')) {
      return ERROR_CODES.OS_PLUG_GLOC_0003;
    }

    // Priority 4: Timeout
    if (msg.includes('timeout')) {
      return ERROR_CODES.OS_PLUG_GLOC_0010;
    }

    // Priority 5: General unavailability
    if (msg.includes('location')) {
      return ERROR_CODES.OS_PLUG_GLOC_0002;
    }
  }

  return ERROR_CODES.OS_PLUG_GLOC_0002; // Generic error
}

/**
 * Full geolocation readiness check
 * Checks both permissions and services
 *
 * @returns {Promise<Object>}
 *
 * @example
 * const readiness = await checkLocationReadiness();
 * if (readiness.ready) {
 *   // Can use geolocation
 * } else {
 *   IS_DEBUG && locationPermissionLogger.log('Issue:', readiness.issue);
 * }
 */
export async function checkLocationReadiness() {
  const permission = await checkLocationPermission();

  if (!permission.isGranted) {
    return {
      ready: false,
      issue: 'permission',
      permission,
      servicesEnabled: null,
    };
  }

  const servicesEnabled = await isLocationServicesEnabled();

  if (!servicesEnabled) {
    return {
      ready: false,
      issue: 'services',
      permission,
      servicesEnabled: false,
    };
  }

  return {
    ready: true,
    issue: null,
    permission,
    servicesEnabled: true,
  };
}
