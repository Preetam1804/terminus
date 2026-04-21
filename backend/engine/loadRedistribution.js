const {
  findAllPathsLimited,
  getEdgesFromPath
} = require("../utils/graphUtils");

function redistributeLoad(graph, failedEdge) {
  const { from, to, load } = failedEdge;

  // Find alternative paths
  const paths = findAllPathsLimited(graph, from, to, 5);

  if (paths.length === 0) {
    return graph; // no alternative → blackout
  }

  // Calculate path capacities
  const pathData = paths.map(path => {
    const edges = getEdgesFromPath(graph, path);

    const capacity = Math.min(...edges.map(e => e.capacity));

    return { path, edges, capacity };
  });

  const totalCapacity = pathData.reduce((sum, p) => sum + p.capacity, 0);

  // Distribute load
  pathData.forEach(p => {
    const share = (p.capacity / totalCapacity) * load;

    p.edges.forEach(edge => {
      edge.load += share;
    });
  });

  return graph;
}

module.exports = {
  redistributeLoad
};
