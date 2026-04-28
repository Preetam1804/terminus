// stressEngine.js

function updateStress(graph) {
  const readyToFail = [];

  graph.edges.forEach(edge => {
    if (edge.status === "failed") return;

    const stress = edge.load / edge.capacity;

    if (stress > 1) {
      // Accumulate proportionally to stress, meaning worse edges hit threshold faster
      edge.overloadTime += stress * 0.6;
      edge.status = "overloaded";
    } else if (stress > 0.75) {
      // Near capacity — mark as stressed but don't accumulate failure time
      edge.status = "near";
      edge.overloadTime = Math.max(0, edge.overloadTime - 0.5);
    } else {
      // Recover
      edge.overloadTime = Math.max(0, edge.overloadTime - 1);
      edge.status = "normal";
    }

    // Identify edges that have breached the failure threshold
    if (edge.overloadTime >= edge.threshold) {
      readyToFail.push(edge);
    }
  });

  const newlyFailed = [];

  // Critical fix: Only fail the worst edge per tick! 
  // This forces a staggered cascade instead of simultaneous collapse.
  if (readyToFail.length > 0) {
    readyToFail.sort((a, b) => (b.load / b.capacity) - (a.load / a.capacity));
    
    const worstEdge = readyToFail[0];
    worstEdge.status = "failed";
    newlyFailed.push(worstEdge);
  }

  return newlyFailed;
}

module.exports = {
  updateStress
};
