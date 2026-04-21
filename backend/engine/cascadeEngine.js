// cascadeEngine.js

const { cloneGraph } = require("../utils/graphUtils");
const { redistributeLoad } = require("./loadRedistribution");
const { updateStress } = require("./stressEngine");

function runCascade(initialGraph, failedEdgeId) {
  let graph = cloneGraph(initialGraph);

  const history = []; // store steps

  // Step 1: initial failure
  const failedEdge = graph.edges.find(e => e.id === failedEdgeId);
  if (failedEdge) {
    failedEdge.status = "failed";
    redistributeLoad(graph, failedEdge);
  }

  let unstable = true;
  let maxSteps = 20;
  let step = 0;

  while (unstable && step < maxSteps) {
    step++;
    unstable = false;

    // Step 2: update stress
    const newFailures = updateStress(graph);

    if (newFailures.length > 0 || graph.edges.some(e => e.status === "overloaded")) {
      unstable = true;
    }

    if (newFailures.length > 0) {
      // Step 3: redistribute for each new failure
      newFailures.forEach(edge => {
        redistributeLoad(graph, edge);
      });
    }

    // Save snapshot (deep clone to prevent mutations)
    history.push(JSON.parse(JSON.stringify(graph)));
  }

  return history;
}

function runCascadeLive(graph, failedEdgeId, io, socket, onEnd) {

  const failedEdge = graph.edges.find(e => e.id === failedEdgeId);

  if (failedEdge) {
    failedEdge.status = "failed";
    redistributeLoad(graph, failedEdge);
  }

  let step = 0;
  let maxSteps = 20;

  // Let frontend know the immediate failure state first
  socket.emit("simulationStep", { step, graph });
  step++;

  const interval = setInterval(() => {
    if (step >= maxSteps) {
      clearInterval(interval);
      if (onEnd) onEnd();
      return;
    }

    const newFailures = updateStress(graph);

    if (newFailures.length > 0) {
      newFailures.forEach(edge => {
        redistributeLoad(graph, edge);
      });
    } else if (!graph.edges.some(e => e.status === "overloaded")) {
      clearInterval(interval);
      if (onEnd) onEnd();
      return; // Stop processing and don't emit a duplicate step if nothing changed
    }

    // 🔥 SEND STEP TO FRONTEND
    socket.emit("simulationStep", { step, graph });

    step++;
  }, 1000); // 1 second per step

  return interval;
}

module.exports = {
  runCascade,
  runCascadeLive
};
