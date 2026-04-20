// failureEngine.js

const { cloneGraph, removeEdge, removeNode } = require("../utils/graphUtils");

// Fail an edge
function failEdge(graph, edgeId) {
  return removeEdge(graph, edgeId);
}

// Fail a node
function failNode(graph, nodeId) {
  return removeNode(graph, nodeId);
}

module.exports = {
  failEdge,
  failNode
};