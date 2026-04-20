// Quick manual test file for graphUtils
const utils = require('./utils/graphUtils');

console.log('========== GRAPH UTILITIES MANUAL TEST ==========\n');

// Sample graph with 4 nodes and connections
const graph = {
  nodes: ['A', 'B', 'C', 'D'],
  edges: [
    { id: 1, from: 'A', to: 'B', status: 'active' },
    { id: 2, from: 'B', to: 'C', status: 'active' },
    { id: 3, from: 'C', to: 'D', status: 'active' },
    { id: 4, from: 'A', to: 'C', status: 'active' },
  ],
};

console.log('Original Graph:', JSON.stringify(graph, null, 2));

// Test 1: getNeighbors
console.log('\n--- Test 1: getNeighbors ---');
console.log('Neighbors of A:', utils.getNeighbors(graph, 'A'));
console.log('Neighbors of B:', utils.getNeighbors(graph, 'B'));
console.log('Neighbors of C:', utils.getNeighbors(graph, 'C'));

// Test 2: findAllPaths
console.log('\n--- Test 2: findAllPaths ---');
const paths = utils.findAllPaths(graph, 'A', 'D');
console.log('All paths from A to D:', paths);

// Test 3: removeEdge
console.log('\n--- Test 3: removeEdge ---');
const graphClone1 = utils.cloneGraph(graph);
const modifiedGraph1 = utils.removeEdge(graphClone1, 1);
console.log('After removing edge 1 (A→B):');
console.log('Neighbors of A:', utils.getNeighbors(modifiedGraph1, 'A'));
console.log('Edges:', modifiedGraph1.edges.map((e) => `${e.id}: ${e.status}`));

// Test 4: removeNode
console.log('\n--- Test 4: removeNode ---');
const graphClone2 = utils.cloneGraph(graph);
const modifiedGraph2 = const modifiedGraph2 = utils.removeNode(graphClone2, 'B');
console.log('After removing node B:');
console.log('Neighbors of A:', utils.getNeighbors(modifiedGraph2, 'A'));
console.log('Edges:', modifiedGraph2.edges.map((e) => `${e.id}: ${e.status}`));

// Test 5: cloneGraph independence
console.log('\n--- Test 5: cloneGraph (independence check) ---');
const original = {
  nodes: ['X', 'Y'],
  edges: [{ id: 1, from: 'X', to: 'Y', status: 'active' }],
};
const cloned = utils.cloneGraph(original);
cloned.nodes[0] = 'Z';
cloned.edges[0].status = 'failed';
console.log('Original nodes:', original.nodes);
console.log('Cloned nodes:', cloned.nodes);
console.log('Original edge status:', original.edges[0].status);
console.log('Cloned edge status:', cloned.edges[0].status);
console.log('✓ Clone is independent!' + (original.nodes[0] === 'X' ? ' Confirmed.' : ' FAILED!'));

// Test 6: Edge case - isolated nodes
console.log('\n--- Test 6: Isolated Nodes ---');
const isolatedGraph = {
  nodes: ['Alone', 'Also Alone'],
  edges: [],
};
console.log('Neighbors of isolated node:', utils.getNeighbors(isolatedGraph, 'Alone'));

console.log('\n========== ALL MANUAL TESTS COMPLETED ==========\n');
