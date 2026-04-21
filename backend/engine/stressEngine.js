// stressEngine.js

function updateStress(graph) {
  const failedEdges = [];

  graph.edges.forEach(edge => {
    if (edge.status === "failed") return;

    const stress = edge.load / edge.capacity;

    // Only accumulate if overloaded
    if (stress > 1) {
      edge.overloadTime += stress;
      edge.status = "overloaded";
    } else {
      // Recover slowly (optional realism)
      edge.overloadTime = Math.max(0, edge.overloadTime - 0.5);
      edge.status = "normal";
    }

    // Check failure
    if (edge.overloadTime >= edge.threshold) {
      edge.status = "failed";
      failedEdges.push(edge);
    }
  });

  return failedEdges;
}

module.exports = {
  updateStress
};
