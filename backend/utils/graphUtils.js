// graphUtils.js

// ? Validation Helper Functions
function isValidGraph(graph) {
  if (!graph || typeof graph !== "object") {
    throw new Error("Graph must be a valid object");
  }
  if (!Array.isArray(graph.nodes)) {
    throw new Error("Graph must have a 'nodes' array");
  }
  if (!Array.isArray(graph.edges)) {
    throw new Error("Graph must have an 'edges' array");
  }
  return true;
}

function isValidNode(graph, nodeId) {
  if (!nodeId) {
    throw new Error("Node ID cannot be empty or null");
  }
  // Handle both string nodes and object nodes with id property
  const exists = graph.nodes.some((node) =>
    (typeof node === 'string' && node === nodeId) ||
    (typeof node === 'object' && node.id === nodeId)
  );
  if (!exists) {
    throw new Error(`Node '${nodeId}' does not exist in the graph`);
  }
  return true;
}

function isValidEdge(graph, edgeId) {
  if (!edgeId) {
    throw new Error("Edge ID cannot be empty or null");
  }
  const exists = graph.edges.some((edge) => edge.id === edgeId);
  if (!exists) {
    throw new Error(`Edge '${edgeId}' does not exist in the graph`);
  }
  return true;
}

// 1?? Get neighbors of a node (ignoring failed edges)
function getNeighbors(graph, nodeId) {
  isValidGraph(graph);
  isValidNode(graph, nodeId);

  const neighbors = [];

  graph.edges.forEach((edge) => {
    if (edge.status === "failed") return;

    if (edge.from === nodeId) {
      neighbors.push(edge.to);
    } else if (edge.to === nodeId) {
      neighbors.push(edge.from);
    }
  });

  return neighbors;
}

// 2?? Find all paths using DFS (unlimited)
function findAllPaths(
  graph,
  start,
  end,
  visited = new Set(),
  path = [],
  allPaths = []
) {
  // Validate only on initial call (when visited is empty)
  if (visited.size === 0) {
    isValidGraph(graph);
    isValidNode(graph, start);
    isValidNode(graph, end);
  }

  visited.add(start);
  path.push(start);

  if (start === end) {
    allPaths.push([...path]);
  } else {
    const neighbors = getNeighbors(graph, start);

    for (let neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        findAllPaths(
          graph,
          neighbor,
          end,
          visited,
          path,
          allPaths
        );
      }
    }
  }

  path.pop();
  visited.delete(start);

  return allPaths;
}

// 2b?? Find all paths with maximum limit (PATH LIMITING)
function findAllPathsLimited(
  graph,
  start,
  end,
  maxPaths = 5,
  visited = new Set(),
  path = [],
  allPaths = []
) {
  // Validate only on initial call (when visited is empty)
  if (visited.size === 0) {
    isValidGraph(graph);
    isValidNode(graph, start);
    isValidNode(graph, end);
    if (maxPaths < 1) {
      throw new Error("maxPaths must be at least 1");
    }
  }

  // Stop searching if we've found enough paths
  if (allPaths.length >= maxPaths) {
    return allPaths;
  }

  visited.add(start);
  path.push(start);

  if (start === end) {
    allPaths.push([...path]);
  } else {
    const neighbors = getNeighbors(graph, start);

    for (let neighbor of neighbors) {
      if (!visited.has(neighbor) && allPaths.length < maxPaths) {
        findAllPathsLimited(
          graph,
          neighbor,
          end,
          maxPaths,
          visited,
          path,
          allPaths
        );
      }
    }
  }

  path.pop();
  visited.delete(start);

  return allPaths;
}

// 3?? Remove edge (mark as failed) - NO DIRECT MUTATION
function removeEdge(graph, edgeId) {
  isValidGraph(graph);
  isValidEdge(graph, edgeId);

  // Clone graph to avoid direct mutation
  const newGraph = cloneGraph(graph);
  newGraph.edges = newGraph.edges.map((edge) => {
    if (edge.id === edgeId) {
      return { ...edge, status: "failed" };
    }
    return edge;
  });

  return newGraph;
}

// 4?? Remove node (fail all connected edges) - NO DIRECT MUTATION
function removeNode(graph, nodeId) {
  isValidGraph(graph);
  isValidNode(graph, nodeId);

  // Clone graph to avoid direct mutation
  const newGraph = cloneGraph(graph);
  newGraph.edges = newGraph.edges.map((edge) => {
    if (edge.from === nodeId || edge.to === nodeId) {
      return { ...edge, status: "failed" };
    }
    return edge;
  });

  return newGraph;
}

// 5?? Clone graph (deep copy)
function cloneGraph(graph) {
  isValidGraph(graph);
  return JSON.parse(JSON.stringify(graph));
}

// 6?? Get edges in a path (EDGE EXTRACTION)
function getEdgesFromPath(graph, path) {
  isValidGraph(graph);

  const edgesInPath = [];

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];

    const edge = graph.edges.find(
      (e) =>
        (e.from === from && e.to === to) ||
        (e.from === to && e.to === from)
    );

    if (edge && edge.status !== "failed") {
      edgesInPath.push(edge);
    }
  }

  return edgesInPath;
}

// Export all
module.exports = {
  getNeighbors,
  findAllPaths,
  findAllPathsLimited,
  removeEdge,
  removeNode,
  cloneGraph,
  getEdgesFromPath,
  isValidGraph,
  isValidNode,
  isValidEdge,
};
