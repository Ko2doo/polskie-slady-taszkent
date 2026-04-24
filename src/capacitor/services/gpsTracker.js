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
 *     IS_DEBUG && gpsTrackerLogger.log('New position:', position.coords);
 *   },
 *   onError: (error) => {
 *     IS_DEBUG && gpsTrackerLogger.error('GPS error:', error);
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
import { checkLocationPermission, requestLocationPermission, mapGeolocationError } from './locationPermission';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const gpsTrackerLogger = createLogger('GPSTracker');

// Configuration
const GPS_OPTIONS = {
  enableHighAccuracy: true, // Use GPS instead of network location
  timeout: 20000, // 20 seconds timeout
  maximumAge: 0, // Don't use cached position
};

// Distance threshold to consider user "off route" (in meters)
const OFF_ROUTE_THRESHOLD = 50;

// Ignore position updates where GPS accuracy is worse than this (in meters)
const MAX_ACCEPTABLE_ACCURACY = 30;

// Ignore position updates if user moved less than this distance (in meters)
// Filters out GPS jitter while standing still
const MIN_DISTANCE_UPDATE = 5;

// How many route points to look back/ahead from last known position
// Avoids scanning the entire route on every update
const ROUTE_SEARCH_WINDOW = 50;

// Map bounds for Tashkent (to check if user is within map area)
const MAP_BOUNDS = {
  minLon: 69.1038931009432,
  minLat: 41.144224013212,
  maxLon: 69.5436061519978,
  maxLat: 41.4359965669526,
};

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
 * Calculate perpendicular distance from point P to segment AB.
 * Falls back to distance to nearest endpoint if projection is outside segment.
 *
 * @param {Object} p - Point {lat, lon}
 * @param {Object} a - Segment start {lat, lon}
 * @param {Object} b - Segment end {lat, lon}
 * @returns {number} - Distance in meters
 */
function distanceToSegment(p, a, b) {
  // Work in a flat approximation — accurate enough for short segments (<1km)
  const dx = b.lon - a.lon;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Degenerate segment (a === b)
    return calculateDistance(p.lat, p.lon, a.lat, a.lon);
  }

  // t is the projection parameter [0, 1]
  const t = Math.max(0, Math.min(1, ((p.lon - a.lon) * dx + (p.lat - a.lat) * dy) / lenSq));

  const projLat = a.lat + t * dy;
  const projLon = a.lon + t * dx;

  return calculateDistance(p.lat, p.lon, projLat, projLon);
}

/**
 * Find nearest point on route from current position.
 * Searches within a window around lastRouteIndex for performance,
 * falls back to full scan if nothing found nearby.
 *
 * @param {Object} position - Current position {lat, lon}
 * @param {Array} routeCoordinates - Route coordinates [[lon, lat], ...]
 * @param {number} [lastIndex=0] - Last known route index to search around
 * @returns {Object} - {nearestPoint: {lat, lon}, distance: number, index: number}
 */
export function findNearestPointOnRoute(position, routeCoordinates, lastIndex = 0) {
  let minDistance = Infinity;
  let nearestPoint = null;
  let nearestIndex = -1;

  const total = routeCoordinates.length;

  // Clamp window to valid range — always search forward from lastIndex
  const from = Math.max(0, lastIndex - 5); // small lookback in case of GPS jump
  const to = Math.min(total - 1, lastIndex + ROUTE_SEARCH_WINDOW);

  // Determine search range; fall back to full route if window is too small
  const start = from;
  const end = to < from + 5 ? total - 1 : to;

  for (let i = start; i < end; i++) {
    const [lonA, latA] = routeCoordinates[i];
    const [lonB, latB] = routeCoordinates[i + 1];

    const dist = distanceToSegment(position, { lat: latA, lon: lonA }, { lat: latB, lon: lonB });

    if (dist < minDistance) {
      minDistance = dist;
      nearestIndex = i;
      // Nearest point approximation: use the closer endpoint of the segment
      const dA = calculateDistance(position.lat, position.lon, latA, lonA);
      const dB = calculateDistance(position.lat, position.lon, latB, lonB);
      nearestPoint = dA < dB ? { lat: latA, lon: lonA } : { lat: latB, lon: lonB };
    }
  }

  // If window search found nothing (edge case), full scan
  if (nearestIndex === -1) {
    for (let i = 0; i < total - 1; i++) {
      const [lonA, latA] = routeCoordinates[i];
      const [lonB, latB] = routeCoordinates[i + 1];

      const dist = distanceToSegment(position, { lat: latA, lon: lonA }, { lat: latB, lon: lonB });

      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
        const dA = calculateDistance(position.lat, position.lon, latA, lonA);
        const dB = calculateDistance(position.lat, position.lon, latB, lonB);
        nearestPoint = dA < dB ? { lat: latA, lon: lonA } : { lat: latB, lon: lonB };
      }
    }
  }

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

  // Tracks progress along route to narrow down search window
  let lastRouteIndex = 0;

  /**
   * Check if GPS permissions are granted
   * Uses locationPermissions service
   * @returns {Promise<boolean>}
   */
  async function checkPermissions() {
    try {
      const result = await checkLocationPermission();
      IS_DEBUG && gpsTrackerLogger.log('Current permissions:', result.status);

      return result.isGranted;
    } catch (error) {
      IS_DEBUG && gpsTrackerLogger.error('Failed to check permissions:', error);
      return false;
    }
  }

  /**
   * Request GPS permissions
   * Uses locationPermissions service
   * @returns {Promise<boolean>} - true if granted
   */
  async function requestPermissions() {
    IS_DEBUG && gpsTrackerLogger.log('Requesting permissions...');

    const result = await requestLocationPermission({
      onSuccess: () => {
        IS_DEBUG && gpsTrackerLogger.log('Permissions granted');
      },
      onDenied: () => {
        IS_DEBUG && gpsTrackerLogger.log('Permissions denied');

        if (onError) {
          onError({
            code: ERROR_CODES.OS_PLUG_GLOC_0003,
            message: 'GPS permission denied by user',
          });
        }
      },
      onError: (err) => {
        IS_DEBUG && gpsTrackerLogger.error('Permission request error:', err);

        if (onError) {
          onError({
            code: err.code,
            message: err.message,
            error: err.error,
          });
        }
      },
    });

    return result.success;
  }

  /**
   * Get current position (one-time).
   * Retries up to MAX_POSITION_ATTEMPTS times if accuracy is too poor —
   * GPS often returns a coarse network-based fix on the first call,
   * then converges to a more accurate reading within a few seconds.
   *
   * @returns {Promise<Object|null>} - Position object or null
   */
  async function getCurrentPosition() {
    const MAX_POSITION_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 2000;

    for (let attempt = 1; attempt <= MAX_POSITION_ATTEMPTS; attempt++) {
      try {
        IS_DEBUG && gpsTrackerLogger.log(`Getting current position (attempt ${attempt}/${MAX_POSITION_ATTEMPTS})...`);

        const position = await Geolocation.getCurrentPosition(GPS_OPTIONS);
        const positionData = transformPositionData(position);

        IS_DEBUG &&
          gpsTrackerLogger.log('Current position:', {
            lat: positionData.lat,
            lon: positionData.lon,
            accuracy: positionData.accuracy,
            withinBounds: positionData.isWithinBounds,
          });

        // Accept position if accuracy is good enough
        if (positionData.accuracy <= MAX_ACCEPTABLE_ACCURACY) {
          return positionData;
        }

        IS_DEBUG &&
          gpsTrackerLogger.log(
            `Position accuracy too low (${positionData.accuracy.toFixed(0)}m > ${MAX_ACCEPTABLE_ACCURACY}m)` +
              (attempt < MAX_POSITION_ATTEMPTS ? `, retrying in ${RETRY_DELAY_MS}ms...` : ', using best available'),
          );

        // On last attempt return whatever we have — better than nothing for flyTo
        if (attempt === MAX_POSITION_ATTEMPTS) {
          return positionData;
        }

        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      } catch (error) {
        IS_DEBUG && gpsTrackerLogger.error(`Failed to get current position (attempt ${attempt}):`, error);

        // Only report error on last attempt to avoid spamming on transient failures
        if (attempt === MAX_POSITION_ATTEMPTS) {
          if (onError) {
            const errorCode = mapGeolocationError(error);

            onError({
              code: errorCode,
              message: error.message || 'Failed to get GPS position',
              error,
            });
          }
        } else {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    return null;
  }

  /**
   * Start watching position (continuous tracking)
   * @returns {Promise<boolean>} - true if started successfully
   */
  async function start() {
    if (isTracking) {
      IS_DEBUG && gpsTrackerLogger.warn('Already tracking');
      return true;
    }

    // Check platform
    if (!Capacitor.isNativePlatform()) {
      IS_DEBUG && gpsTrackerLogger.warn('GPS tracking only works on native platforms');

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
      IS_DEBUG && gpsTrackerLogger.error('GPS permission denied, cannot start tracking');
      return false;
    }

    // Start watching
    try {
      IS_DEBUG && gpsTrackerLogger.log('Starting position watch...');

      watchId = await Geolocation.watchPosition(GPS_OPTIONS, (position, error) => {
        if (error) {
          IS_DEBUG && gpsTrackerLogger.error('Watch position error:', error);

          const errorCode = mapGeolocationError(error);

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

        if (!position) return;

        const positionData = transformPositionData(position);

        // Discard readings with poor accuracy (e.g. right after cold start)
        if (positionData.accuracy > MAX_ACCEPTABLE_ACCURACY) {
          IS_DEBUG && gpsTrackerLogger.log(`Skipping low-accuracy position (${positionData.accuracy.toFixed(0)}m)`);
          return;
        }

        // Discard if user hasn't moved enough — filters GPS jitter while standing still
        if (lastPosition) {
          const moved = calculateDistance(lastPosition.lat, lastPosition.lon, positionData.lat, positionData.lon);

          if (moved < MIN_DISTANCE_UPDATE) {
            return;
          }
        }

        lastPosition = positionData;

        IS_DEBUG &&
          gpsTrackerLogger.log('Position update:', {
            lat: positionData.lat,
            lon: positionData.lon,
            accuracy: positionData.accuracy,
            withinBounds: positionData.isWithinBounds,
          });

        if (onPositionUpdate) {
          onPositionUpdate(positionData);
        }
      });

      isTracking = true;
      IS_DEBUG && gpsTrackerLogger.log('Position watch started, ID:', watchId);

      return true;
    } catch (error) {
      IS_DEBUG && gpsTrackerLogger.error('Failed to start watch:', error);

      if (onError) {
        const errorCode = mapGeolocationError(error);
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
   * Stop watching position.
   * lastPosition is preserved so callers can still read it after stopping.
   */
  async function stop() {
    if (!isTracking || watchId === null) {
      IS_DEBUG && gpsTrackerLogger.warn('Not tracking');
      return;
    }

    try {
      await Geolocation.clearWatch({ id: watchId });
      isTracking = false;
      watchId = null;
      lastRouteIndex = 0;
      // lastPosition intentionally kept — callers may read it after stop()

      IS_DEBUG && gpsTrackerLogger.log('Position watch stopped');
    } catch (error) {
      IS_DEBUG && gpsTrackerLogger.error('Failed to stop watch:', error);
    }
  }

  /**
   * Check if user is off route.
   * Updates internal route progress index for efficient windowed search.
   * Accounts for current GPS accuracy to avoid false positives.
   *
   * @param {Array} routeCoordinates - Route coordinates [[lon, lat], ...]
   * @returns {Object|null} - {isOffRoute: boolean, distance: number, threshold: number} or null
   */
  function checkOffRoute(routeCoordinates) {
    if (!lastPosition || !routeCoordinates || routeCoordinates.length === 0) {
      return null;
    }

    const { distance, index } = findNearestPointOnRoute(lastPosition, routeCoordinates, lastRouteIndex);

    // Advance window — never go backwards (user moves forward along route)
    if (index > lastRouteIndex) {
      lastRouteIndex = index;
    }

    // Expand the threshold by current GPS accuracy so a 28m accuracy reading
    // doesn't trigger off-route when the user is actually on the route.
    const accuracy = lastPosition.accuracy ?? 0;
    const effectiveThreshold = OFF_ROUTE_THRESHOLD + accuracy;

    return {
      isOffRoute: distance > effectiveThreshold,
      distance,
      threshold: effectiveThreshold,
    };
  }

  /**
   * Reset route progress tracking.
   * Call this when a new route is loaded.
   */
  function resetRoute() {
    lastRouteIndex = 0;
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
    resetRoute,

    // State getters
    get isTracking() {
      return isTracking;
    },
    get lastPosition() {
      return lastPosition;
    },
  };
}
