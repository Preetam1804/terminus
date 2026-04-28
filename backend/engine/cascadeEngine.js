// cascadeEngine.js

const { cloneGraph } = require("../utils/graphUtils");
const { redistributeLoad } = require("./loadRedistribution");
const { updateStress } = require("./stressEngine");

// ── Derive node stress from connected edges ────────────────────
function enrichNodeStress(graph) {
  graph.nodes.forEach(node => {
    const connectedEdges = graph.edges.filter(
      e => (e.from === node.id || e.to === node.id) && e.status !== "failed"
    );

    if (connectedEdges.length === 0) {
      // All connected edges failed → node is isolated
      node.status = "failed";
      node.stress = 1;
      return;
    }

    // Stress = max ratio of load/capacity among connected edges
    const maxStress = Math.max(...connectedEdges.map(e => e.load / e.capacity));
    node.stress = parseFloat(maxStress.toFixed(3));

    if (maxStress > 1) {
      node.status = "overloaded";
    } else if (maxStress > 0.75) {
      node.status = "stressed";
    } else {
      node.status = "normal";
    }
  });
}

function runCascade(initialGraph, failedEdgeId) {
  let graph = cloneGraph(initialGraph);

  const history = [];

  // ── Step 0: initial failure ────────────────────────────────────
  const failedEdge = graph.edges.find(e => e.id === failedEdgeId);
  if (!failedEdge) return history;

  failedEdge.status = "failed";
  enrichNodeStress(graph);
  history.push(JSON.parse(JSON.stringify(graph))); // snapshot: initial failure

  // ── Step 1: redistribute load after failure ───────────────────
  redistributeLoad(graph, failedEdge);
  enrichNodeStress(graph);
  history.push(JSON.parse(JSON.stringify(graph))); // snapshot: load redistributed

  // ── Steps 2+: cascade propagation ─────────────────────────────
  let unstable = true;
  let maxSteps = 20;
  let step = 0;

  while (unstable && step < maxSteps) {
    step++;
    unstable = false;

    const newFailures = updateStress(graph);

    // Snapshot: after stress update (shows overloaded state before failure)
    enrichNodeStress(graph);
    history.push(JSON.parse(JSON.stringify(graph)));

    if (newFailures.length > 0) {
      unstable = true;

      // Redistribute for each new failure
      newFailures.forEach(edge => {
        redistributeLoad(graph, edge);
      });

      // Snapshot: after redistribution
      enrichNodeStress(graph);
      history.push(JSON.parse(JSON.stringify(graph)));
    }

    if (graph.edges.some(e => e.status === "overloaded")) {
      unstable = true;
    }
  }

  return history;
}

function runCascadeLive(graph, failedEdgeId, io, socket, onEnd) {

  const failedEdge = graph.edges.find(e => e.id === failedEdgeId);

  if (failedEdge) {
    failedEdge.status = "failed";
    enrichNodeStress(graph);
    redistributeLoad(graph, failedEdge);
    enrichNodeStress(graph);
  }

  let step = 0;
  let maxSteps = 20;

  // Let frontend know the immediate failure state first
  socket.emit("simulationStep", { step, graph });
  step++;

  const interval = setInterval(() => {
    if (step >= maxSteps) {
      clearInterval(interval);
      socket.emit("simulationEnd", { graph });
      if (onEnd) onEnd();
      return;
    }

    const newFailures = updateStress(graph);
    enrichNodeStress(graph);

    if (newFailures.length > 0) {
      newFailures.forEach(edge => {
        redistributeLoad(graph, edge);
      });
      enrichNodeStress(graph);
    } else if (!graph.edges.some(e => e.status === "overloaded")) {
      clearInterval(interval);
      socket.emit("simulationEnd", { graph });
      if (onEnd) onEnd();
      return;
    }

    socket.emit("simulationStep", { step, graph });
    step++;
  }, 1400); // 1.4s per live step

  return interval;
}

module.exports = {
  runCascade,
  runCascadeLive
};
