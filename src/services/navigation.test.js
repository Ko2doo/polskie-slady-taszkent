import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { articlesMeta } from '@/data/articles';
import NavigationEngine from '@/services/navigation';

// Fixture graphs are laid out in meters around a point in Tashkent and converted to degrees,
// so a test reads as "B is 100 m east of A" instead of a pile of coordinates.
const ORIGIN = { lon: 69.24, lat: 41.3 };
const METERS_PER_DEGREE_LAT = 111195;
const METERS_PER_DEGREE_LON = METERS_PER_DEGREE_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);

function at(eastMeters, northMeters) {
  return {
    lon: ORIGIN.lon + eastMeters / METERS_PER_DEGREE_LON,
    lat: ORIGIN.lat + northMeters / METERS_PER_DEGREE_LAT,
  };
}

// Both directions, as the graph pipeline produces them (see public/map/navigation-graph-optimized.json)
function twoWay(from, to, distance) {
  return [
    { from, to, distance },
    { from: to, to: from, distance },
  ];
}

/**
 *  A ── B ── C        A–B–C: 100 m + 100 m
 *  │         │
 *  D ─────── E        A–D–E–C: 100 m + 200 m + 100 m
 */
function squareGraph({ bcDistance = 100 } = {}) {
  return {
    nodes: {
      A: at(0, 0),
      B: at(100, 0),
      C: at(200, 0),
      D: at(0, -100),
      E: at(200, -100),
    },
    edges: [
      ...twoWay('A', 'B', 100),
      ...twoWay('B', 'C', bcDistance),
      ...twoWay('A', 'D', 100),
      ...twoWay('D', 'E', 200),
      ...twoWay('E', 'C', 100),
    ],
  };
}

/**
 * A size × size grid, 100 m between neighbors, every street 1×–3× its straight length
 * (never shorter, so the straight-line heuristic stays admissible). Deterministic: a fixed LCG.
 */
function unevenGrid(size = 10) {
  let seed = 42;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };

  const nodes = {};
  const edges = [];
  const id = (x, y) => `g${x}_${y}`;
  const helper = new NavigationEngine({ nodes: {}, edges: [] });

  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) nodes[id(x, y)] = at(x * 100, y * 100);
  }

  const connect = (a, b) => {
    const straight = helper.distance(nodes[a].lon, nodes[a].lat, nodes[b].lon, nodes[b].lat);
    edges.push(...twoWay(a, b, straight * (1 + 2 * random())));
  };

  for (let x = 0; x < size; x += 1) {
    for (let y = 0; y < size; y += 1) {
      if (x + 1 < size) connect(id(x, y), id(x + 1, y));
      if (y + 1 < size) connect(id(x, y), id(x, y + 1));
    }
  }

  return { graph: { nodes, edges }, size };
}

// Plain O(n²) Dijkstra: slow, obviously correct, independent of the engine's heap and heuristic
function referenceDistance({ nodes, edges }, from, to) {
  const distance = Object.fromEntries(Object.keys(nodes).map((node) => [node, Infinity]));
  const done = new Set();
  distance[from] = 0;

  while (done.size < Object.keys(nodes).length) {
    let current = null;
    for (const node of Object.keys(nodes)) {
      if (!done.has(node) && (current === null || distance[node] < distance[current])) current = node;
    }
    if (current === to || distance[current] === Infinity) break;

    done.add(current);
    for (const edge of edges) {
      if (edge.from === current) distance[edge.to] = Math.min(distance[edge.to], distance[current] + edge.distance);
    }
  }

  return distance[to];
}

describe('constructor', () => {
  it('builds the adjacency list from the edges', () => {
    const engine = new NavigationEngine(squareGraph());

    expect(engine.adjacency.A).toEqual([
      { to: 'B', distance: 100 },
      { to: 'D', distance: 100 },
    ]);
  });

  it('drops edges that point to a missing node', () => {
    const graph = squareGraph();
    graph.edges.push({ from: 'A', to: 'ghost', distance: 1 }, { from: 'ghost', to: 'A', distance: 1 });

    const engine = new NavigationEngine(graph);

    expect(engine.adjacency.A.map((edge) => edge.to)).toEqual(['B', 'D']);
    expect(engine.adjacency.ghost).toBeUndefined();
  });

  it('accepts an empty graph', () => {
    const engine = new NavigationEngine({ nodes: {}, edges: [] });

    expect(engine.findNearestNode(ORIGIN.lon, ORIGIN.lat)).toEqual({ nodeId: null, distance: Infinity });
  });
});

describe('distance', () => {
  const engine = new NavigationEngine({ nodes: {}, edges: [] });

  it('is zero for the same point', () => {
    expect(engine.distance(69.24, 41.3, 69.24, 41.3)).toBe(0);
  });

  it('one degree of latitude is ~111.2 km', () => {
    expect(engine.distance(69, 41, 69, 42)).toBeCloseTo(111195, 0);
  });

  it('is symmetric', () => {
    expect(engine.distance(69.2, 41.3, 69.3, 41.35)).toBe(engine.distance(69.3, 41.35, 69.2, 41.3));
  });
});

describe('findNearestNode', () => {
  it('finds the closest node and its distance', () => {
    const engine = new NavigationEngine(squareGraph());
    const point = at(90, 5);

    const result = engine.findNearestNode(point.lon, point.lat);

    expect(result.nodeId).toBe('B');
    expect(result.distance).toBeCloseTo(engine.distance(point.lon, point.lat, engine.nodes.B.lon, engine.nodes.B.lat));
  });

  // A grid cell is ~1 km: a node two cells away is outside the 3×3 window
  it('widens the search to 5×5 cells when the 3×3 window is empty', () => {
    const engine = new NavigationEngine({ nodes: { far: at(1500, 0) }, edges: [] });

    expect(engine.findNearestNode(ORIGIN.lon, ORIGIN.lat).nodeId).toBe('far');
  });

  it('finds nothing beyond the 5×5 window', () => {
    const engine = new NavigationEngine({ nodes: { far: at(5000, 0) }, edges: [] });

    expect(engine.findNearestNode(ORIGIN.lon, ORIGIN.lat)).toEqual({ nodeId: null, distance: Infinity });
  });
});

describe('findPath', () => {
  it('takes the shortest path', () => {
    const result = new NavigationEngine(squareGraph()).findPath('A', 'C');

    expect(result.success).toBe(true);
    expect(result.path).toEqual(['A', 'B', 'C']);
    expect(result.distance).toBe(200);
  });

  // Edge weights win over geometry: a short-looking street can be a long walk
  it('goes around when the direct street is longer to walk', () => {
    const result = new NavigationEngine(squareGraph({ bcDistance: 1000 })).findPath('A', 'C');

    expect(result.path).toEqual(['A', 'D', 'E', 'C']);
    expect(result.distance).toBe(400);
  });

  it('a route to the start node itself is just that node', () => {
    const result = new NavigationEngine(squareGraph()).findPath('B', 'B');

    expect(result).toMatchObject({ success: true, path: ['B'], distance: 0 });
  });

  // Lazy deletion in the open heap: X is first reached by a worse path, then improved
  it('replaces a worse path to a node found earlier', () => {
    const graph = {
      nodes: { S: at(0, 0), X: at(100, 0), Y: at(50, 300), T: at(200, 0) },
      edges: [...twoWay('S', 'X', 1000), ...twoWay('S', 'Y', 310), ...twoWay('Y', 'X', 310), ...twoWay('X', 'T', 100)],
    };

    const result = new NavigationEngine(graph).findPath('S', 'T');

    expect(result.path).toEqual(['S', 'Y', 'X', 'T']);
    expect(result.distance).toBe(720);
  });

  // Y is explored before X (lower f), and its way to X is worse: it must not overwrite the better one
  it('keeps a better path when a worse one to the same node turns up later', () => {
    const graph = {
      nodes: { S: at(0, 0), X: at(100, 30), Y: at(20, 0), T: at(200, 0) },
      edges: [...twoWay('S', 'X', 105), ...twoWay('S', 'Y', 20), ...twoWay('Y', 'X', 500), ...twoWay('X', 'T', 105)],
    };

    const result = new NavigationEngine(graph).findPath('S', 'T');

    expect(result.path).toEqual(['S', 'X', 'T']);
    expect(result.distance).toBe(210);
  });

  // Property check against a plain Dijkstra on a grid with uneven street lengths
  it('finds the same shortest distance as a reference Dijkstra', () => {
    const { graph, size } = unevenGrid();
    const engine = new NavigationEngine(graph);
    const pairs = [
      ['g0_0', `g${size - 1}_${size - 1}`],
      [`g0_${size - 1}`, `g${size - 1}_0`],
      ['g2_3', 'g7_6'],
      ['g5_1', 'g1_8'],
    ];

    for (const [from, to] of pairs) {
      expect(engine.findPath(from, to).distance).toBeCloseTo(referenceDistance(graph, from, to), 6);
    }
  });

  it('respects one-way edges', () => {
    const graph = {
      nodes: { A: at(0, 0), B: at(100, 0) },
      edges: [{ from: 'A', to: 'B', distance: 100 }],
    };
    const engine = new NavigationEngine(graph);

    expect(engine.findPath('A', 'B').success).toBe(true);
    expect(engine.findPath('B', 'A')).toMatchObject({ success: false, message: 'No path found between points' });
  });

  it('reports disconnected parts of the graph', () => {
    const graph = {
      nodes: { A: at(0, 0), B: at(100, 0), C: at(300, 0) },
      edges: [...twoWay('A', 'B', 100)],
    };

    expect(new NavigationEngine(graph).findPath('A', 'C')).toMatchObject({
      success: false,
      message: 'No path found between points',
    });
  });

  it('reports a node that is not in the graph', () => {
    const engine = new NavigationEngine(squareGraph());

    expect(engine.findPath('A', 'missing')).toEqual({
      success: false,
      message: 'Start or end node not found',
      computeTime: 0,
    });
    expect(engine.findPath('missing', 'A').success).toBe(false);
  });

  it('refuses points too far apart without searching', () => {
    const graph = {
      nodes: { A: at(0, 0), B: at(0, 51000) },
      edges: [...twoWay('A', 'B', 51000)],
    };

    const result = new NavigationEngine(graph).findPath('A', 'B');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Points are too far apart: 51.0 km');
    expect(result.iterations).toBeUndefined();
  });

  it('a long route under the distance limit is still searched', () => {
    const graph = {
      nodes: { A: at(0, 0), B: at(0, 49000) },
      edges: [...twoWay('A', 'B', 49000)],
    };

    expect(new NavigationEngine(graph).findPath('A', 'B').success).toBe(true);
  });

  // A chain longer than the iteration limit (100 000) but shorter than the distance limit (50 km)
  it('gives up after the iteration limit', () => {
    const NODE_COUNT = 100005;
    const STEP_METERS = 0.4;
    const nodes = {};
    const edges = [];

    for (let index = 0; index < NODE_COUNT; index += 1) {
      nodes[`n${index}`] = at(0, index * STEP_METERS);
      if (index > 0) edges.push({ from: `n${index - 1}`, to: `n${index}`, distance: STEP_METERS });
    }

    const result = new NavigationEngine({ nodes, edges }).findPath('n0', `n${NODE_COUNT - 1}`);

    expect(result).toMatchObject({ success: false, message: 'Pathfinding timeout after 100000 iterations' });
  });
});

describe('findRoute', () => {
  it('returns a GeoJSON line from the real start to the real end through the graph', () => {
    const engine = new NavigationEngine(squareGraph());
    const from = at(-10, 0);
    const to = at(210, 0);

    const result = engine.findRoute(from.lon, from.lat, to.lon, to.lat);
    const { nodes } = engine;

    expect(result.success).toBe(true);
    expect(result.route.type).toBe('Feature');
    expect(result.route.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [from.lon, from.lat],
        [nodes.A.lon, nodes.A.lat],
        [nodes.B.lon, nodes.B.lat],
        [nodes.C.lon, nodes.C.lat],
        [to.lon, to.lat],
      ],
    });
  });

  it('the distance includes the walk to and from the graph', () => {
    const engine = new NavigationEngine(squareGraph());
    const from = at(-10, 0);
    const to = at(210, 0);
    const snapStart = engine.distance(from.lon, from.lat, engine.nodes.A.lon, engine.nodes.A.lat);
    const snapEnd = engine.distance(to.lon, to.lat, engine.nodes.C.lon, engine.nodes.C.lat);

    const { properties } = engine.findRoute(from.lon, from.lat, to.lon, to.lat).route;

    expect(properties.distance).toBeCloseTo(200 + snapStart + snapEnd, 6);
    expect(properties.nodes).toBe(3);
    expect(properties.iterations).toBeGreaterThan(0);
  });

  it('refuses a point more than 1 km away from the road network', () => {
    const engine = new NavigationEngine(squareGraph());
    const from = at(0, 0);
    const to = at(200, -1200);

    expect(engine.findRoute(from.lon, from.lat, to.lon, to.lat)).toEqual({
      success: false,
      message: 'Point is too far from road network (>1km)',
    });
    expect(engine.findRoute(to.lon, to.lat, from.lon, from.lat).success).toBe(false);
  });

  it('refuses a point with no node anywhere near it', () => {
    const engine = new NavigationEngine(squareGraph());
    const to = at(0, 10000);

    expect(engine.findRoute(ORIGIN.lon, ORIGIN.lat, to.lon, to.lat).success).toBe(false);
  });

  it('passes a failed path search through', () => {
    const graph = {
      nodes: { A: at(0, 0), B: at(300, 0) },
      edges: [],
    };
    const engine = new NavigationEngine(graph);

    expect(engine.findRoute(ORIGIN.lon, ORIGIN.lat, graph.nodes.B.lon, graph.nodes.B.lat)).toMatchObject({
      success: false,
      message: 'No path found between points',
    });
  });
});

// The graph's JSON shape is a contract between scripts/navigationGraph/ and this engine
// (.claude/rules/map-data-pipeline.md): the shipped file must load and route between real places.
describe('the shipped navigation graph', () => {
  const graph = JSON.parse(readFileSync('public/map/navigation-graph-optimized.json', 'utf8'));
  const engine = new NavigationEngine(graph);

  it('has the { nodes, edges } shape the engine expects', () => {
    const [nodeId, node] = Object.entries(graph.nodes)[0];
    const [edge] = graph.edges;

    expect(typeof nodeId).toBe('string');
    expect(node).toEqual({ lon: expect.any(Number), lat: expect.any(Number) });
    expect(edge).toMatchObject({ from: expect.any(String), to: expect.any(String), distance: expect.any(Number) });
  });

  it('routes between two historical places', () => {
    // articles.js stores [latitude, longitude]
    const [fromLat, fromLon] = articlesMeta[0].coords;
    const [toLat, toLon] = articlesMeta[1].coords;

    const result = engine.findRoute(fromLon, fromLat, toLon, toLat);

    expect(result.success).toBe(true);
    expect(result.route.properties.distance).toBeGreaterThan(engine.distance(fromLon, fromLat, toLon, toLat));
  });

  // A pedestrian may walk both ways along a one-way street: only a footway/path/steps/pedestrian
  // way tagged one-way (or oneway:foot) is one-way in the graph (scripts/navigationGraph)
  it('is walkable both ways: almost every edge has its reverse', () => {
    const edgeKeys = new Set(graph.edges.map((edge) => `${edge.from}>${edge.to}`));
    const oneWay = graph.edges.filter((edge) => !edgeKeys.has(`${edge.to}>${edge.from}`));

    expect(oneWay.length / graph.edges.length).toBeLessThan(0.001);
  });

  it('connects every historical place with every other one, both ways', () => {
    const unreachable = [];
    for (const from of articlesMeta) {
      for (const to of articlesMeta) {
        if (from === to) continue;
        const [fromLat, fromLon] = from.coords;
        const [toLat, toLon] = to.coords;
        if (!engine.findRoute(fromLon, fromLat, toLon, toLat).success) unreachable.push(`${from.id}→${to.id}`);
      }
    }

    expect(unreachable).toEqual([]);
  });
});
