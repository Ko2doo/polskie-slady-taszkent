/**
 * NavigationLoader
 *
 * Lazy loads navigation graph and initializes NavigationEngine.
 * Includes LRU route caching for better performance.
 *
 * Cache behaviour:
 * - Routes are cached bidirectionally (A→B lookup also covers B→A)
 * - LRU eviction: least recently used entry is removed when cache is full
 * - Cache size: MAX_CACHE_SIZE unique origin-destination pairs
 */

import NavigationEngine from './navigation';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const navLoaderLogger = createLogger('NavigationLoader');

let navigationEngine = null;
let loadingPromise = null;

// Route cache — Map preserves insertion order, which we exploit for LRU
const routeCache = new Map();
const MAX_CACHE_SIZE = 50;

/**
 * Generate a canonical cache key from coordinates.
 * Keys are sorted so A→B and B→A map to the same entry.
 * Rounded to 5 decimal places (~1 meter precision).
 */
function getCacheKey(fromLon, fromLat, toLon, toLat) {
  const a = `${fromLon.toFixed(5)},${fromLat.toFixed(5)}`;
  const b = `${toLon.toFixed(5)},${toLat.toFixed(5)}`;
  // Lexicographic sort gives a stable key regardless of direction
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * Touch a key to mark it as recently used (LRU promotion).
 * Map iteration order reflects insertion order in JS —
 * re-inserting moves the key to the end (most recent).
 */
function touchKey(key) {
  const value = routeCache.get(key);
  routeCache.delete(key);
  routeCache.set(key, value);
}

/**
 * Find cached route (checks both directions via canonical key)
 */
export function findCachedRoute(fromLon, fromLat, toLon, toLat) {
  const key = getCacheKey(fromLon, fromLat, toLon, toLat);
  const cached = routeCache.get(key);

  if (cached) {
    touchKey(key); // Promote to most-recently-used
    IS_DEBUG && navLoaderLogger.log('Using cached route');
    return cached;
  }

  return null;
}

/**
 * Cache a route with LRU eviction
 */
export function cacheRoute(fromLon, fromLat, toLon, toLat, route) {
  const key = getCacheKey(fromLon, fromLat, toLon, toLat);

  // If key already exists, remove it first so re-insert puts it at the end
  if (routeCache.has(key)) {
    routeCache.delete(key);
  }

  routeCache.set(key, route);

  // LRU eviction: the first key in the Map is the least recently used
  if (routeCache.size > MAX_CACHE_SIZE) {
    const lruKey = routeCache.keys().next().value;
    routeCache.delete(lruKey);
    IS_DEBUG && navLoaderLogger.log('Cache limit reached, removed LRU entry');
  }

  IS_DEBUG && navLoaderLogger.log(`Route cached (${routeCache.size}/${MAX_CACHE_SIZE})`);
}

/**
 * Clear route cache
 */
export function clearRouteCache() {
  const size = routeCache.size;
  routeCache.clear();
  IS_DEBUG && navLoaderLogger.log(`Cache cleared (${size} entries removed)`);
}

/**
 * Get cache statistics (size only — keys are internal implementation detail)
 */
export function getCacheStats() {
  return {
    size: routeCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}

/**
 * Initialize navigation engine
 */
export async function initNavigation() {
  // Already initialized
  if (navigationEngine) {
    return navigationEngine;
  }

  // Loading in progress — return the same promise so concurrent callers wait together
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    IS_DEBUG && navLoaderLogger.log('Loading navigation graph...');
    const startTime = performance.now();

    try {
      const response = await fetch('/map/navigation-graph-optimized.json');

      if (!response.ok) {
        throw new Error(`Failed to load navigation graph: ${response.status}`);
      }

      const graphData = await response.json();
      const loadTime = performance.now() - startTime;

      IS_DEBUG && navLoaderLogger.log(`Graph loaded in ${loadTime.toFixed(0)}ms`);
      IS_DEBUG && navLoaderLogger.log('Initializing navigation engine...');

      navigationEngine = new NavigationEngine(graphData);

      const totalTime = performance.now() - startTime;
      IS_DEBUG && navLoaderLogger.log(`Ready in ${totalTime.toFixed(0)}ms`);

      return navigationEngine;
    } catch (error) {
      IS_DEBUG && navLoaderLogger.error('Failed to initialize navigation:', error);
      // Reset so the next call to initNavigation() can retry
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

/**
 * Get navigation engine instance (throws if not initialized)
 */
export function getNavigationEngine() {
  if (!navigationEngine) {
    throw new Error('Navigation engine not initialized. Call initNavigation() first.');
  }
  return navigationEngine;
}

/**
 * Check if navigation is ready
 */
export function isNavigationReady() {
  return navigationEngine !== null;
}

/**
 * Find route with LRU caching.
 * Cache is bidirectional — A→B and B→A share the same cached result.
 */
export function findRoute(fromLon, fromLat, toLon, toLat) {
  const cached = findCachedRoute(fromLon, fromLat, toLon, toLat);
  if (cached) {
    return cached;
  }

  const nav = getNavigationEngine();
  const result = nav.findRoute(fromLon, fromLat, toLon, toLat);

  if (result.success) {
    cacheRoute(fromLon, fromLat, toLon, toLat, result);
  }

  return result;
}
