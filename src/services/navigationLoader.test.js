import { describe, it, expect, vi, beforeEach } from 'vitest';

// A tiny real graph: A ── B ── C along one street, 100 m apart
const GRAPH = {
  nodes: {
    A: { lon: 69.24, lat: 41.3 },
    B: { lon: 69.2412, lat: 41.3 },
    C: { lon: 69.2424, lat: 41.3 },
  },
  edges: [
    { from: 'A', to: 'B', distance: 100 },
    { from: 'B', to: 'A', distance: 100 },
    { from: 'B', to: 'C', distance: 100 },
    { from: 'C', to: 'B', distance: 100 },
  ],
};
const FROM = [69.2399, 41.3];
const TO = [69.2425, 41.3];

const okResponse = (data = GRAPH) => ({ ok: true, status: 200, json: async () => data });

// The engine and the route cache are module-level: every test works with a fresh copy
let loader;

beforeEach(async () => {
  vi.resetModules();
  loader = await import('@/services/navigationLoader');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => okResponse()),
  );
});

describe('initNavigation', () => {
  it('loads the shipped graph and builds the engine', async () => {
    const engine = await loader.initNavigation();

    expect(fetch).toHaveBeenCalledWith('/map/navigation-graph-optimized.json');
    expect(Object.keys(engine.nodes)).toEqual(['A', 'B', 'C']);
    expect(loader.isNavigationReady()).toBe(true);
    expect(loader.getNavigationEngine()).toBe(engine);
  });

  it('loads the graph only once, also for concurrent callers', async () => {
    const [first, second] = await Promise.all([loader.initNavigation(), loader.initNavigation()]);
    const third = await loader.initNavigation();

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects on an HTTP error and can be retried', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 404 });

    await expect(loader.initNavigation()).rejects.toThrow('Failed to load navigation graph: 404');
    expect(loader.isNavigationReady()).toBe(false);

    await expect(loader.initNavigation()).resolves.toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects on a broken file and can be retried', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input');
      },
    });

    await expect(loader.initNavigation()).rejects.toThrow('Unexpected end of JSON input');
    await expect(loader.initNavigation()).resolves.toBeTruthy();
  });

  it('rejects when the request itself fails', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(loader.initNavigation()).rejects.toThrow('Failed to fetch');
    expect(loader.isNavigationReady()).toBe(false);
  });
});

describe('getNavigationEngine / isNavigationReady before init', () => {
  it('is not ready and throws on access', () => {
    expect(loader.isNavigationReady()).toBe(false);
    expect(() => loader.getNavigationEngine()).toThrow('Navigation engine not initialized');
  });
});

describe('findRoute', () => {
  it('throws before the engine is initialized', () => {
    expect(() => loader.findRoute(...FROM, ...TO)).toThrow('Navigation engine not initialized');
  });

  it('returns the route of the engine and caches it', async () => {
    const engine = await loader.initNavigation();
    const search = vi.spyOn(engine, 'findRoute');

    const first = loader.findRoute(...FROM, ...TO);
    const second = loader.findRoute(...FROM, ...TO);

    expect(first.success).toBe(true);
    expect(second).toBe(first);
    expect(search).toHaveBeenCalledTimes(1);
    expect(loader.getCacheStats().size).toBe(1);
  });

  it('serves the opposite direction from the same cache entry', async () => {
    const engine = await loader.initNavigation();
    const search = vi.spyOn(engine, 'findRoute');

    loader.findRoute(...FROM, ...TO);
    loader.findRoute(...TO, ...FROM);

    expect(search).toHaveBeenCalledTimes(1);
  });

  // BUG: the cache key is direction-free, so B→A gets the cached A→B line, which starts at A
  // (see BUGS.md). Remove `.fails` once fixed.
  it.fails('a route from the cache starts at the requested origin', async () => {
    await loader.initNavigation();

    loader.findRoute(...FROM, ...TO);
    const back = loader.findRoute(...TO, ...FROM);

    expect(back.route.geometry.coordinates[0]).toEqual(TO);
  });

  it('points closer than ~1 m (5 decimals) share a cache entry', async () => {
    const engine = await loader.initNavigation();
    const search = vi.spyOn(engine, 'findRoute');

    loader.findRoute(69.239901, 41.3, ...TO);
    loader.findRoute(69.239904, 41.3, ...TO);

    expect(search).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed route', async () => {
    const engine = await loader.initNavigation();
    const search = vi.spyOn(engine, 'findRoute');
    const farAway = [69.5, 41.6];

    expect(loader.findRoute(...FROM, ...farAway).success).toBe(false);
    loader.findRoute(...FROM, ...farAway);

    expect(search).toHaveBeenCalledTimes(2);
    expect(loader.getCacheStats().size).toBe(0);
  });
});

describe('route cache', () => {
  // Distinct destinations, one per cache slot
  const destination = (index) => [69 + index / 1000, 41];
  const route = (index) => ({ success: true, id: index });

  it('stores and finds a route in both directions', () => {
    loader.cacheRoute(1, 2, 3, 4, route(1));

    expect(loader.findCachedRoute(1, 2, 3, 4)).toEqual(route(1));
    expect(loader.findCachedRoute(3, 4, 1, 2)).toEqual(route(1));
    expect(loader.findCachedRoute(1, 2, 3, 5)).toBeNull();
  });

  it('caching the same pair again replaces it without growing', () => {
    loader.cacheRoute(1, 2, 3, 4, route(1));
    loader.cacheRoute(3, 4, 1, 2, route(2));

    expect(loader.getCacheStats().size).toBe(1);
    expect(loader.findCachedRoute(1, 2, 3, 4)).toEqual(route(2));
  });

  it('evicts the least recently used route when full', () => {
    const { maxSize } = loader.getCacheStats();

    for (let index = 0; index < maxSize; index += 1) {
      loader.cacheRoute(0, 0, ...destination(index), route(index));
    }

    // Using route 0 makes route 1 the least recently used one
    loader.findCachedRoute(0, 0, ...destination(0));
    loader.cacheRoute(0, 0, ...destination(maxSize), route(maxSize));

    expect(loader.getCacheStats().size).toBe(maxSize);
    expect(loader.findCachedRoute(0, 0, ...destination(0))).toEqual(route(0));
    expect(loader.findCachedRoute(0, 0, ...destination(1))).toBeNull();
    expect(loader.findCachedRoute(0, 0, ...destination(maxSize))).toEqual(route(maxSize));
  });

  it('re-caching an existing route makes it the most recent', () => {
    const { maxSize } = loader.getCacheStats();

    for (let index = 0; index < maxSize; index += 1) {
      loader.cacheRoute(0, 0, ...destination(index), route(index));
    }

    loader.cacheRoute(0, 0, ...destination(0), route(0));
    loader.cacheRoute(0, 0, ...destination(maxSize), route(maxSize));

    expect(loader.findCachedRoute(0, 0, ...destination(0))).toEqual(route(0));
    expect(loader.findCachedRoute(0, 0, ...destination(1))).toBeNull();
  });

  it('clearRouteCache empties it', () => {
    loader.cacheRoute(1, 2, 3, 4, route(1));

    loader.clearRouteCache();

    expect(loader.getCacheStats().size).toBe(0);
    expect(loader.findCachedRoute(1, 2, 3, 4)).toBeNull();
  });
});
