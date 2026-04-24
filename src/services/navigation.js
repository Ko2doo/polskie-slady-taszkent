import { createLogger, IS_DEBUG } from '@/utils/debugMode';

const navEngineLogger = createLogger('NavigationEngine');

/**
 * NavigationEngine
 *
 * A* pathfinding algorithm for pedestrian navigation
 */

// A* limits — named constants instead of magic numbers at call site
const MAX_ITERATIONS = 100000;
const MAX_ROUTE_DISTANCE = 50000; // meters
const MAX_NODE_SNAP_DISTANCE = 1000; // meters — point must be within 1km of road network

// Spatial index cell size in degrees (~1km)
const GRID_CELL_SIZE = 0.01;

// ─── Min-Heap ────────────────────────────────────────────────────────────────
// Simple binary min-heap keyed by numeric priority.
// Replaces the O(n) Set scan in the A* open set — gives O(log n) push/pop.

class MinHeap {
  constructor() {
    this._heap = []; // [{priority, value}]
  }

  get size() {
    return this._heap.length;
  }

  push(value, priority) {
    this._heap.push({ value, priority });
    this._bubbleUp(this._heap.length - 1);
  }

  pop() {
    const top = this._heap[0];
    const last = this._heap.pop();

    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._sinkDown(0);
    }

    return top?.value;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this._heap[parent].priority <= this._heap[i].priority) break;
      [this._heap[parent], this._heap[i]] = [this._heap[i], this._heap[parent]];
      i = parent;
    }
  }

  _sinkDown(i) {
    const n = this._heap.length;
    while (true) {
      let smallest = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;

      if (l < n && this._heap[l].priority < this._heap[smallest].priority) smallest = l;
      if (r < n && this._heap[r].priority < this._heap[smallest].priority) smallest = r;
      if (smallest === i) break;

      [this._heap[smallest], this._heap[i]] = [this._heap[i], this._heap[smallest]];
      i = smallest;
    }
  }
}
// ─────────────────────────────────────────────────────────────────────────────

class NavigationEngine {
  constructor(graphData) {
    this.nodes = graphData.nodes;
    this.edges = graphData.edges;

    // // Build adjacency list for fast lookup
    // this.adjacency = {};
    // this.edges.forEach((edge) => {
    //   if (!this.adjacency[edge.from]) {
    //     this.adjacency[edge.from] = [];
    //   }
    //   this.adjacency[edge.from].push({
    //     to: edge.to,
    //     distance: edge.distance,
    //   });
    // });

    // this.buildSpatialIndex();

    // // Check graph integrity
    // let invalidEdges = 0;
    // this.edges.forEach((edge) => {
    //   if (!this.nodes[edge.from] || !this.nodes[edge.to]) {
    //     invalidEdges++;
    //   }
    // });

    // Build adjacency list + validate in on pass.
    // Invalid edges are counted but NOT added to the graph.
    this.adjacency = {};
    let invalidEdges = 0;

    this.edges.forEach((edge) => {
      if (!this.nodes[edge.from] || !this.nodes[edge.to]) {
        invalidEdges++;

        return; // skip - don`t pollute the graph with dangling edges
      }

      (this.adjacency[edge.from] ??= []).push({
        to: edge.to,
        distance: edge.distance,
      });
    });

    this.buildSpatialIndex();

    if (invalidEdges > 0) {
      IS_DEBUG && navEngineLogger.warn(`Found ${invalidEdges} edges with missing nodes`);
    }

    IS_DEBUG && navEngineLogger.group('Initialized');
    IS_DEBUG && navEngineLogger.log('  Nodes:', Object.keys(this.nodes).length);
    IS_DEBUG && navEngineLogger.log('  Edges (total):', this.edges.length);
    IS_DEBUG && navEngineLogger.log('  Edges (in graph):', this.edges.length - invalidEdges);
    IS_DEBUG && navEngineLogger.log('  Invalid edges:', invalidEdges);
    IS_DEBUG && navEngineLogger.groupEnd();
  }

  // Haversine distance between two points
  distance(lon1, lat1, lon2, lat2) {
    const R = 6371000;
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

  buildSpatialIndex() {
    this.grid = {};

    Object.entries(this.nodes).forEach(([nodeId, node]) => {
      const cellX = Math.floor(node.lon / GRID_CELL_SIZE);
      const cellY = Math.floor(node.lat / GRID_CELL_SIZE);
      const cellKey = `${cellX},${cellY}`;

      if (!this.grid[cellKey]) {
        this.grid[cellKey] = [];
      }
      this.grid[cellKey].push({ id: nodeId, ...node });
    });

    IS_DEBUG && navEngineLogger.log('Spatial index built');
  }

  /**
   * Find nearest graph node to given coordinates.
   * Searches 3×3 cell window first; expands to 5×5 if nothing found
   * (handles edge cases where point sits on cell boundary with no nearby nodes).
   */
  findNearestNode(lon, lat) {
    const cellX = Math.floor(lon / GRID_CELL_SIZE);
    const cellY = Math.floor(lat / GRID_CELL_SIZE);

    const search = (radius) => {
      let nearestNode = null;
      let minDistance = Infinity;

      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const cellKey = `${cellX + dx},${cellY + dy}`;
          const cellNodes = this.grid[cellKey] || [];

          cellNodes.forEach((node) => {
            const dist = this.distance(lon, lat, node.lon, node.lat);
            if (dist < minDistance) {
              minDistance = dist;
              nearestNode = node.id;
            }
          });
        }
      }

      return { nodeId: nearestNode, distance: minDistance };
    };

    // Try 3×3 first
    const result = search(1);

    // Fall back to 5×5 if nothing found (point on cell edge with sparse nodes)
    if (!result.nodeId) {
      IS_DEBUG && navEngineLogger.warn('No node found in 3x3 window, expanding to 5x5');
      return search(2);
    }

    return result;
  }

  /**
   * A* pathfinding with min-heap open set for O(log n) node selection.
   * Includes iteration limit and straight-line distance guard.
   */
  findPath(startNodeId, endNodeId) {
    const start = performance.now();

    const endNode = this.nodes[endNodeId];
    const startNode = this.nodes[startNodeId];

    if (!endNode || !startNode) {
      IS_DEBUG && navEngineLogger.error('Start or end node not found in graph');
      return {
        success: false,
        message: 'Start or end node not found',
        computeTime: 0,
      };
    }

    // Bail early if points are unreachably far apart
    const straightLineDistance = this.distance(startNode.lon, startNode.lat, endNode.lon, endNode.lat);

    if (straightLineDistance > MAX_ROUTE_DISTANCE) {
      return {
        success: false,
        message: `Points are too far apart: ${(straightLineDistance / 1000).toFixed(1)} km`,
        computeTime: Math.round(performance.now() - start),
      };
    }

    // Open set as min-heap keyed by fScore — O(log n) vs O(n) Set scan.
    // We allow duplicate entries for the same node (lazy deletion):
    // when a better path is found we push again with a lower priority,
    // and skip stale entries via the closedSet check after pop.
    const openHeap = new MinHeap();
    openHeap.push(startNodeId, straightLineDistance);

    const closedSet = new Set();
    const cameFrom = {};

    const gScore = { [startNodeId]: 0 };

    let iterations = 0;

    while (openHeap.size > 0) {
      iterations++;

      if (iterations > MAX_ITERATIONS) {
        IS_DEBUG && navEngineLogger.error('Max iterations reached');
        return {
          success: false,
          message: `Pathfinding timeout after ${MAX_ITERATIONS} iterations`,
          computeTime: Math.round(performance.now() - start),
        };
      }

      if (iterations % 10000 === 0) {
        IS_DEBUG && navEngineLogger.log(`Iteration ${iterations}, open set size: ${openHeap.size}`);
      }

      const current = openHeap.pop();

      // Skip stale duplicate entries — node was already processed via a better path
      if (closedSet.has(current)) continue;

      if (current === endNodeId) {
        const path = this.reconstructPath(cameFrom, current);

        IS_DEBUG && navEngineLogger.log(`Path found in ${iterations} iterations`);

        return {
          success: true,
          path,
          distance: gScore[endNodeId],
          computeTime: Math.round(performance.now() - start),
          iterations,
        };
      }

      closedSet.add(current);

      const neighbors = this.adjacency[current] || [];

      for (const neighbor of neighbors) {
        if (!this.nodes[neighbor.to]) continue;
        if (closedSet.has(neighbor.to)) continue;

        const tentativeGScore = gScore[current] + neighbor.distance;

        if (tentativeGScore >= (gScore[neighbor.to] ?? Infinity)) continue;

        cameFrom[neighbor.to] = current;
        gScore[neighbor.to] = tentativeGScore;

        const neighborNode = this.nodes[neighbor.to];
        const heuristic = this.distance(neighborNode.lon, neighborNode.lat, endNode.lon, endNode.lat);
        const f = tentativeGScore + heuristic;

        // Push with updated priority — old entry (if any) becomes stale
        // and will be skipped by the closedSet check after pop
        openHeap.push(neighbor.to, f);
      }
    }

    return {
      success: false,
      message: 'No path found between points',
      computeTime: Math.round(performance.now() - start),
      iterations,
    };
  }

  // Reconstruct path from cameFrom map — push + reverse avoids O(n²) unshift
  reconstructPath(cameFrom, current) {
    const path = [];
    while (current !== undefined) {
      path.push(current);
      current = cameFrom[current];
    }
    return path.reverse();
  }

  // Main function: find route from point A to point B
  findRoute(fromLon, fromLat, toLon, toLat) {
    IS_DEBUG && navEngineLogger.log(`Finding route from [${fromLon}, ${fromLat}] to [${toLon}, ${toLat}]`);

    const startResult = this.findNearestNode(fromLon, fromLat);
    const endResult = this.findNearestNode(toLon, toLat);

    IS_DEBUG && navEngineLogger.log(`  Start node: ${startResult.nodeId} (${startResult.distance.toFixed(1)}m away)`);
    IS_DEBUG && navEngineLogger.log(`  End node: ${endResult.nodeId} (${endResult.distance.toFixed(1)}m away)`);

    if (startResult.distance > MAX_NODE_SNAP_DISTANCE || endResult.distance > MAX_NODE_SNAP_DISTANCE) {
      return {
        success: false,
        message: `Point is too far from road network (>${MAX_NODE_SNAP_DISTANCE / 1000}km)`,
      };
    }

    const pathResult = this.findPath(startResult.nodeId, endResult.nodeId);

    if (!pathResult.success) {
      return pathResult;
    }

    // Convert node IDs to coordinates
    const coordinates = pathResult.path.map((nodeId) => {
      const node = this.nodes[nodeId];
      return [node.lon, node.lat];
    });

    // Prepend actual start point and append actual end point
    coordinates.unshift([fromLon, fromLat]);
    coordinates.push([toLon, toLat]);

    return {
      success: true,
      route: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          distance: pathResult.distance + startResult.distance + endResult.distance,
          nodes: pathResult.path.length,
          computeTime: pathResult.computeTime,
          iterations: pathResult.iterations,
        },
      },
    };
  }
}

export default NavigationEngine;
