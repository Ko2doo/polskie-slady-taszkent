/**
 * NavigationLoader
 *
 * Lazy loads navigation graph and initializes NavigationEngine
 * Includes route caching for better performance
 */

import NavigationEngine from './navigation';

let navigationEngine = null;
let loadingPromise = null;

// Route cache
const routeCache = new Map();
const MAX_CACHE_SIZE = 50;

/**
 * Generate cache key from coordinates
 */
function getCacheKey(fromLon, fromLat, toLon, toLat) {
  // Round to 5 decimal places (~1 meter precision)
  return `${fromLon.toFixed(5)},${fromLat.toFixed(5)}-${toLon.toFixed(5)},${toLat.toFixed(5)}`;
}

/**
 * Find cached route
 */
export function findCachedRoute(fromLon, fromLat, toLon, toLat) {
  const key = getCacheKey(fromLon, fromLat, toLon, toLat);
  const cached = routeCache.get(key);

  if (cached) {
    console.log('[NavigationLoader] Using cached route');
    return cached;
  }

  return null;
}

/**
 * Cache a route
 */
export function cacheRoute(fromLon, fromLat, toLon, toLat, route) {
  const key = getCacheKey(fromLon, fromLat, toLon, toLat);

  // Add to cache
  routeCache.set(key, route);

  // Limit cache size (FIFO)
  if (routeCache.size > MAX_CACHE_SIZE) {
    const firstKey = routeCache.keys().next().value;
    routeCache.delete(firstKey);
    console.log('[NavigationLoader] Cache limit reached, removed oldest entry');
  }

  console.log(`[NavigationLoader] Route cached (${routeCache.size}/${MAX_CACHE_SIZE})`);
}

/**
 * Clear route cache
 */
export function clearRouteCache() {
  const size = routeCache.size;
  routeCache.clear();
  console.log(`[NavigationLoader] Cache cleared (${size} entries removed)`);
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: routeCache.size,
    maxSize: MAX_CACHE_SIZE,
    keys: Array.from(routeCache.keys()),
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

  // Loading in progress
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = (async () => {
    console.log('[NavigationLoader] Loading navigation graph...');
    const startTime = performance.now();

    try {
      const response = await fetch('/map/navigation-graph-optimized.json');

      if (!response.ok) {
        throw new Error(`Failed to load navigation graph: ${response.status}`);
      }

      const graphData = await response.json();
      const loadTime = performance.now() - startTime;

      console.log(`[NavigationLoader] Graph loaded in ${loadTime.toFixed(0)}ms`);
      console.log('[NavigationLoader] Initializing navigation engine...');

      navigationEngine = new NavigationEngine(graphData);

      const totalTime = performance.now() - startTime;
      console.log(`[NavigationLoader] Ready in ${totalTime.toFixed(0)}ms`);

      return navigationEngine;
    } catch (error) {
      console.error('[NavigationLoader] Failed to initialize navigation:', error);
      loadingPromise = null;
      throw error;
    }
  })();

  return loadingPromise;
}

/**
 * Get navigation engine instance
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
 * Find route with caching
 */
export function findRoute(fromLon, fromLat, toLon, toLat) {
  // Check cache first
  const cached = findCachedRoute(fromLon, fromLat, toLon, toLat);
  if (cached) {
    return cached;
  }

  // Calculate new route
  const nav = getNavigationEngine();
  const result = nav.findRoute(fromLon, fromLat, toLon, toLat);

  // Cache successful routes
  if (result.success) {
    cacheRoute(fromLon, fromLat, toLon, toLat, result);
  }

  return result;
}
