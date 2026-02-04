/**
 * GPS Tracker Service
 *
 * Manages GPS location tracking using Capacitor Geolocation API.
 *
 * Features:
 * - Request GPS permissions
 * - Check if GPS is enabled
 * - Watch user position in real-time
 * - Calculate distance between coordinates
 * - Detect if user deviated from route
 *
 * Usage:
 * ```javascript
 * import { createGPSTracker } from '@/services/gpsTracker';
 *
 * const gps = createGPSTracker({
 *   onPositionUpdate: (position) => {
 *     console.log('New position:', position.coords);
 *   },
 *   onError: (error) => {
 *     console.error('GPS error:', error);
 *   }
 * });
 *
 * await gps.start();
 * // ... user navigation
 * gps.stop();
 * ```
 */

import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

import { ERROR_CODES } from '@/lib/errors/errorCodes';

// Configuration
const GPS_OPTIONS = {
  enableHighAccuracy: true, // Use GPS instead of network location
  timeout: 20000, // 10 seconds timeout
  maximumAge: 0, // Don't use cached position
};

const WATCH_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
};

// Distance threshold to consider user "off route" (in meters)
const OFF_ROUTE_THRESHOLD = 50; // 50 meters

// Map bounds for Tashkent (to check if user is within map area)
const MAP_BOUNDS = {
  minLon: 69.1038931009432,
  minLat: 41.144224013212,
  maxLon: 69.5436061519978,
  maxLat: 41.4359965669526,
};

/**
 * Capacitor  erro code mapping
 *
 * Map Capacitor native erro codes to our custom error codes
 *
 * @param {Object} error - Capacitor error object
 * @returns {string} - our custom error code
 */
function mapCapacitorError(error) {
  // Check if it`s already our custom error code
  if (error.code && typeof error.code === 'string' && error.code.startsWith('OS_PLUG_GLOC_')) {
    return error.code;
  }

  // Map Capacitor native numberic error codes
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

  // Check error message for specific patterns
  if (error.message) {
    const msg = error.message.toLowerCase();

    // Priority 1: Check for location services disabled FIRST
    if ((msg.includes('location services') && msg.includes('disabled')) || msg.includes('off')) {
      return ERROR_CODES.OS_PLUG_GLOC_0007;
    }

    // Priority 2: Check for network AND location both off
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

    // Priority 5: Generic location unavailable
    if (msg.includes('location')) {
      return ERROR_CODES.OS_PLUG_GLOC_0002;
    }
  }

  return ERROR_CODES.OS_PLUG_GLOC_0002; // Generic error
}

/**
 * Check if coordinates are within map bounds
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {boolean} - true if within bounds
 */
/*prettier-ignore*/
function isWithinMapBounds(lat, lon) {
  return (
    lon >= MAP_BOUNDS.minLon &&
    lon <= MAP_BOUNDS.maxLon &&
    lat >= MAP_BOUNDS.minLat &&
    lat <= MAP_BOUNDS.maxLat
  );
}

/**
 * Calculate Haversine distance between two coordinates
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} - Distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find nearest point on route from current position
 * @param {Object} position - Current position {lat, lon}
 * @param {Array} routeCoordinates - Route coordinates [[lon, lat], ...]
 * @returns {Object} - {nearestPoint: {lat, lon}, distance: number, index: number}
 */
export function findNearestPointOnRoute(position, routeCoordinates) {
  let minDistance = Infinity;
  let nearestPoint = null;
  let nearestIndex = -1;

  routeCoordinates.forEach(([lon, lat], index) => {
    const distance = calculateDistance(position.lat, position.lon, lat, lon);

    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = { lat, lon };
      nearestIndex = index;
    }
  });

  return {
    nearestPoint,
    distance: minDistance,
    index: nearestIndex,
  };
}

/**
 * Transform Capacitor position to our position format
 *
 * @param {Object} position - Capacitor position object
 * @returns {Object} - Transformed position data
 */
function transformPositionData(position) {
  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy,
    altitude: position.coords.altitude,
    heading: position.coords.heading,
    speed: position.coords.speed,
    timestamp: position.timestamp,
    isWithinBounds: isWithinMapBounds(position.coords.latitude, position.coords.longitude),
  };
}

/**
 * Create GPS tracker instance
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onPositionUpdate - Called when position updates
 * @param {Function} callbacks.onError - Called on GPS error
 * @returns {Object} - GPS tracker API
 */
export function createGPSTracker({ onPositionUpdate = null, onError = null } = {}) {
  let watchId = null;
  let isTracking = false;
  let lastPosition = null;

  /**
   * Check if GPS permissions are granted
   * @returns {Promise<boolean>}
   */
  async function checkPermissions() {
    try {
      const permissions = await Geolocation.checkPermissions();
      console.log('[GPSTracker] Current permissions:', permissions.location);

      return permissions.location === 'granted';
    } catch (error) {
      console.error('[GPSTracker] Failed to check permissions:', error);

      return false;
    }
  }

  /**
   * Request GPS permissions
   * @returns {Promise<boolean>} - true if granted
   */
  async function requestPermissions() {
    try {
      console.log('[GPSTracker] Requesting permissions...');

      const permissions = await Geolocation.requestPermissions();
      const granted = permissions.location === 'granted';

      console.log('[GPSTracker] Permissions result:', permissions.location);

      // If denied, call onError with proper code
      if (!granted && onError) {
        onError({
          code: ERROR_CODES.OS_PLUG_GLOC_0003,
          message: 'GPS permission denied by user',
        });
      }

      return granted;
    } catch (error) {
      console.error('[GPSTracker] Failed to request permissions:', error);

      if (onError) {
        const errorCode = mapCapacitorError(error);
        onError({
          code: errorCode,
          message: error.message || 'GPS permission denied',
          error,
        });

        return false;
      }
    }
  }

  /**
   * Get current position (one-time)
   * @returns {Promise<Object|null>} - Position object or null
   */
  async function getCurrentPosition() {
    try {
      console.log('[GPSTracker] Getting current position...');

      const position = await Geolocation.getCurrentPosition(GPS_OPTIONS);
      const positionData = transformPositionData(position);

      console.log('[GPSTracker] Current position:', {
        lat: positionData.lat,
        lon: positionData.lon,
        accuracy: positionData.accuracy,
        withinBounds: positionData.isWithinBounds,
      });

      return positionData;
    } catch (error) {
      console.error('[GPSTracker] Failed to get current position:', error);

      if (onError) {
        const errorCode = mapCapacitorError(error);
        onError({
          code: errorCode,
          message: error.message || 'Failed to get GPS position',
          error,
        });
      }

      return null;
    }
  }

  /**
   * Start watching position (continuous tracking)
   * @returns {Promise<boolean>} - true if started successfully
   */
  async function start() {
    if (isTracking) {
      console.warn('[GPSTracker] Already tracking');
      return true;
    }

    // Check platform
    if (!Capacitor.isNativePlatform()) {
      console.warn('[GPSTracker] GPS tracking only works on native platforms');

      if (onError) {
        onError({
          code: ERROR_CODES.OS_PLUG_GLOC_0002,
          message: 'GPS tracking requires native platform (Android/iOS)',
        });
      }

      return false;
    }

    // Check/request permissions
    let hasPermission = await checkPermissions();

    if (!hasPermission) {
      hasPermission = await requestPermissions();
    }

    // Stop here if no permission granted
    if (!hasPermission) {
      console.error('[GPSTracker] GPS permission denied, cannot start tracking');
      return false;
    }

    // Start watching
    try {
      console.log('[GPSTracker] Starting position watch...');

      watchId = await Geolocation.watchPosition(WATCH_OPTIONS, (position, error) => {
        if (error) {
          console.error('[GPSTracker] Watch position error:', error);

          const errorCode = mapCapacitorError(error);

          // Timeout is not fatal, just waiting for signal
          if (errorCode === ERROR_CODES.OS_PLUG_GLOC_0010) {
            if (onError) {
              onError({ code: errorCode, message: 'Waiting for GPS signal...', error });
            }

            return;
          }

          if (onError) {
            onError({
              code: errorCode,
              message: error.message || 'GPS tracking error',
              error,
            });
          }

          return;
        }

        if (position) {
          const positionData = transformPositionData(position);
          lastPosition = positionData;

          console.log('[GPSTracker] Position update:', {
            lat: positionData.lat,
            lon: positionData.lon,
            accuracy: positionData.accuracy,
            withinBounds: positionData.isWithinBounds,
          });

          if (onPositionUpdate) {
            onPositionUpdate(positionData);
          }
        }
      });

      isTracking = true;
      console.log('[GPSTracker] Position watch started, ID:', watchId);

      return true;
    } catch (error) {
      console.error('[GPSTracker] Failed to start watch:', error);

      if (onError) {
        const errorCode = mapCapacitorError(error);
        onError({
          code: errorCode,
          message: error.message || 'Failed to start GPS tracking',
          error,
        });
      }

      return false;
    }
  }

  /**
   * Stop watching position
   */
  async function stop() {
    if (!isTracking || watchId === null) {
      console.warn('[GPSTracker] Not tracking');
      return;
    }

    try {
      await Geolocation.clearWatch({ id: watchId });
      isTracking = false;
      watchId = null;
      lastPosition = null;

      console.log('[GPSTracker] Position watch stopped');
    } catch (error) {
      console.error('[GPSTracker] Failed to stop watch:', error);
    }
  }

  /**
   * Check if user is off route
   * @param {Array} routeCoordinates - Route coordinates [[lon, lat], ...]
   * @returns {Object|null} - {isOffRoute: boolean, distance: number} or null
   */
  function checkOffRoute(routeCoordinates) {
    if (!lastPosition || !routeCoordinates || routeCoordinates.length === 0) {
      return null;
    }

    const { distance } = findNearestPointOnRoute(lastPosition, routeCoordinates);

    return {
      isOffRoute: distance > OFF_ROUTE_THRESHOLD,
      distance,
      threshold: OFF_ROUTE_THRESHOLD,
    };
  }

  // Public API
  return {
    // Methods
    checkPermissions,
    requestPermissions,
    getCurrentPosition,
    start,
    stop,
    checkOffRoute,

    // State getters
    get isTracking() {
      return isTracking;
    },
    get lastPosition() {
      return lastPosition;
    },
  };
}
