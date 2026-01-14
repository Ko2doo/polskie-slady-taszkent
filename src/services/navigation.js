/**
 * NavigationEngine
 *
 * A* pathfinding algorithm for pedestrian navigation
 */

class NavigationEngine {
  constructor(graphData) {
    this.nodes = graphData.nodes;
    this.edges = graphData.edges;

    // Build adjacency list for fast lookup
    this.adjacency = {};
    this.edges.forEach((edge) => {
      if (!this.adjacency[edge.from]) {
        this.adjacency[edge.from] = [];
      }
      this.adjacency[edge.from].push({
        to: edge.to,
        distance: edge.distance,
      });
    });
    this.buildSpatialIndex();

    // Check graph integrity
    let invalidEdges = 0;
    this.edges.forEach((edge) => {
      if (!this.nodes[edge.from] || !this.nodes[edge.to]) {
        invalidEdges++;
      }
    });

    if (invalidEdges > 0) {
      console.warn(`[NavigationEngine] Found ${invalidEdges} edges with missing nodes`);
    }

    console.log('[NavigationEngine] Initialized');
    console.log('  Nodes:', Object.keys(this.nodes).length);
    console.log('  Edges:', this.edges.length);
    console.log('  Invalid edges:', invalidEdges);
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
    // Разделяем карту на сетку для быстрого поиска
    this.grid = {};
    const cellSize = 0.01; // ~1км

    Object.entries(this.nodes).forEach(([nodeId, node]) => {
      const cellX = Math.floor(node.lon / cellSize);
      const cellY = Math.floor(node.lat / cellSize);
      const cellKey = `${cellX},${cellY}`;

      if (!this.grid[cellKey]) {
        this.grid[cellKey] = [];
      }
      this.grid[cellKey].push({ id: nodeId, ...node });
    });

    console.log('[NavigationEngine] Spatial index built');
  }

  findNearestNode(lon, lat) {
    const cellSize = 0.01;
    const cellX = Math.floor(lon / cellSize);
    const cellY = Math.floor(lat / cellSize);

    let nearestNode = null;
    let minDistance = Infinity;

    // Проверяем только близкие ячейки (3x3 сетка)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
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
  }

  // A* pathfinding algorithm with timeout protection
  findPath(startNodeId, endNodeId, maxIterations = 100000, maxDistance = 50000) {
    const start = performance.now();

    const endNode = this.nodes[endNodeId];
    const startNode = this.nodes[startNodeId];

    if (!endNode || !startNode) {
      console.error('[NavigationEngine] Start or end node not found in graph');
      return {
        success: false,
        message: 'Start or end node not found',
        computeTime: 0,
      };
    }

    // Check if points are too far apart
    const straightLineDistance = this.distance(startNode.lon, startNode.lat, endNode.lon, endNode.lat);

    if (straightLineDistance > maxDistance) {
      return {
        success: false,
        message: `Points are too far apart: ${(straightLineDistance / 1000).toFixed(1)} km`,
        computeTime: Math.round(performance.now() - start),
      };
    }

    const openSet = new Set([startNodeId]);
    const closedSet = new Set();
    const cameFrom = {};

    const gScore = {};
    gScore[startNodeId] = 0;

    const fScore = {};
    fScore[startNodeId] = straightLineDistance;

    let iterations = 0;

    while (openSet.size > 0) {
      iterations++;

      // Timeout protection
      if (iterations > maxIterations) {
        console.error('[NavigationEngine] Max iterations reached');
        return {
          success: false,
          message: `Pathfinding timeout after ${maxIterations} iterations`,
          computeTime: Math.round(performance.now() - start),
        };
      }

      // Progress logging every 10k iterations
      if (iterations % 10000 === 0) {
        console.log(`[NavigationEngine] Iteration ${iterations}, openSet size: ${openSet.size}`);
      }

      // Find node with minimum fScore using more efficient method
      let current = null;
      let minFScore = Infinity;

      for (const nodeId of openSet) {
        const score = fScore[nodeId];
        if (score !== undefined && score < minFScore) {
          minFScore = score;
          current = nodeId;
        }
      }

      if (!current) {
        console.error('[NavigationEngine] No valid node found in openSet');
        break;
      }

      if (current === endNodeId) {
        // Path found!
        const path = this.reconstructPath(cameFrom, current);
        const end = performance.now();

        console.log(`[NavigationEngine] Path found in ${iterations} iterations`);

        return {
          success: true,
          path: path,
          distance: gScore[endNodeId],
          computeTime: Math.round(end - start),
          iterations: iterations,
        };
      }

      openSet.delete(current);
      closedSet.add(current);

      // Check neighbors
      const neighbors = this.adjacency[current] || [];

      for (const neighbor of neighbors) {
        // Skip if node doesn't exist
        if (!this.nodes[neighbor.to]) {
          continue;
        }

        // Skip if already evaluated
        if (closedSet.has(neighbor.to)) {
          continue;
        }

        const tentativeGScore = gScore[current] + neighbor.distance;

        // Skip if this path is worse than existing
        if (tentativeGScore >= (gScore[neighbor.to] || Infinity)) {
          continue;
        }

        // This path is the best so far
        cameFrom[neighbor.to] = current;
        gScore[neighbor.to] = tentativeGScore;

        const neighborNode = this.nodes[neighbor.to];
        const heuristic = this.distance(neighborNode.lon, neighborNode.lat, endNode.lon, endNode.lat);

        fScore[neighbor.to] = tentativeGScore + heuristic;

        openSet.add(neighbor.to);
      }
    }

    const end = performance.now();
    return {
      success: false,
      message: 'No path found between points',
      computeTime: Math.round(end - start),
      iterations: iterations,
    };
  }

  // Reconstruct path from cameFrom map
  reconstructPath(cameFrom, current) {
    const path = [current];
    while (cameFrom[current]) {
      current = cameFrom[current];
      path.unshift(current);
    }
    return path;
  }

  // Main function: find route from point A to point B
  findRoute(fromLon, fromLat, toLon, toLat) {
    console.log(`[NavigationEngine] Finding route from [${fromLon}, ${fromLat}] to [${toLon}, ${toLat}]`);

    // Find nearest nodes
    const startResult = this.findNearestNode(fromLon, fromLat);
    const endResult = this.findNearestNode(toLon, toLat);

    console.log(`  Start node: ${startResult.nodeId} (${startResult.distance.toFixed(1)}m away)`);
    console.log(`  End node: ${endResult.nodeId} (${endResult.distance.toFixed(1)}m away)`);

    if (startResult.distance > 1000 || endResult.distance > 1000) {
      return {
        success: false,
        message: 'Point is too far from road network (>1km)',
      };
    }

    // Find path with limits: 100k iterations, 50km max distance
    const pathResult = this.findPath(startResult.nodeId, endResult.nodeId, 100000, 50000);

    if (!pathResult.success) {
      return pathResult;
    }

    // Convert nodes to coordinates
    const coordinates = pathResult.path.map((nodeId) => {
      const node = this.nodes[nodeId];
      return [node.lon, node.lat];
    });

    // Add start and end points
    coordinates.unshift([fromLon, fromLat]);
    coordinates.push([toLon, toLat]);

    return {
      success: true,
      route: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: coordinates,
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
