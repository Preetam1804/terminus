// failureEngine.js

const { cloneGraph, removeEdge, removeNode } = require("../utils/graphUtils");
const { redistributeLoad } = require("./loadRedistribution");

// Fail an edge
function failEdge(graph, edgeId) {
  const newGraph = cloneGraph(graph);
  const failedEdge = newGraph.edges.find(e => e.id === edgeId);
  const graphWithoutEdge = removeEdge(newGraph, edgeId);
  if (failedEdge) {
    redistributeLoad(graphWithoutEdge, failedEdge);
  }
  return graphWithoutEdge;
}

// Fail a node
function failNode(graph, nodeId) {
  return removeNode(graph, nodeId);
}

module.exports = {
  failEdge,
  failNode
};