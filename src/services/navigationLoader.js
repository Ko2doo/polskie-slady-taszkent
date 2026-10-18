/**
 * NavigationLoader
 *
 * Lazy loads navigation graph and initializes NavigationEngine.
 * Includes LRU route caching for better performance.
 *
 * Cache behaviour:
 * - Routes are cached per direction (A→B and B→A are separate entries, see getCacheKey)
 * - LRU eviction: least recently used entry is removed when cache is full
 * - Cache size: MAX_CACHE_SIZE routes (each origin → destination direction counts once)
 */

import NavigationEngine from './navigation';
import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const navLoaderLogger = createLogger('NavigationLoader');

let navigationEngine = null;
let loadingPromise = null;

// Route cache — Map preserves insertion order, which we exploit for LRU
const routeCache = new Map();
export const MAX_CACHE_SIZE = 50;

/**
 * Generate a cache key from coordinates, rounded to 5 decimal places (~1 meter precision).
 * The key keeps the direction: A→B and B→A are separate entries. The graph has one-way edges
 * and the engine routes along them, so B→A is not always A→B reversed — and a reused A→B line
 * would also start at the wrong end (anything reading the line's order would break).
 */
function getCacheKey(fromLon, fromLat, toLon, toLat) {
  const from = `${fromLon.toFixed(5)},${fromLat.toFixed(5)}`;
  const to = `${toLon.toFixed(5)},${toLat.toFixed(5)}`;
  return `${from}-${to}`;
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
 * Find a cached route for exactly this direction
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
 * Find route with LRU caching (per direction — see getCacheKey).
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
