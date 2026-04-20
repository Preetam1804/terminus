const {
  getNeighbors,
  findAllPaths,
  removeEdge,
  removeNode,
  cloneGraph,
} = require('./graphUtils');

describe('Graph Utilities', () => {
  let testGraph;

  beforeEach(() => {
    testGraph = {
      nodes: ['A', 'B', 'C', 'D'],
      edges: [
        { id: 1, from: 'A', to: 'B', status: 'active' },
        { id: 2, from: 'B', to: 'C', status: 'active' },
        { id: 3, from: 'C', to: 'D', status: 'active' },
        { id: 4, from: 'A', to: 'C', status: 'active' },
      ],
    };
  });

  describe('getNeighbors', () => {
    test('returns direct connections for a node', () => {
      expect(getNeighbors(testGraph, 'A').sort()).toEqual(['B', 'C'].sort());
      expect(getNeighbors(testGraph, 'B')).toEqual(['A', 'C']);
    });

    test('ignores failed edges when finding neighbors', () => {
      const modifiedGraph = removeEdge(testGraph, 1);
      expect(getNeighbors(modifiedGraph, 'A')).toEqual(['C']);
    });

    test('returns empty array for isolated nodes', () => {
      const isolated = {
        nodes: ['X'],
        edges: [],
      };
      expect(getNeighbors(isolated, 'X')).toEqual([]);
    });

    test('works with undirected edges', () => {
      const neighbors = getNeighbors(testGraph, 'C');
      expect(neighbors.includes('B')).toBe(true);
      expect(neighbors.includes('A')).toBe(true);
      expect(neighbors.includes('D')).toBe(true);
    });
  });

  describe('findAllPaths', () => {
    test('finds all routes between two nodes', () => {
      const paths = findAllPaths(testGraph, 'A', 'D');
      expect(paths.length).toBeGreaterThanOrEqual(2);
      expect(paths.some((path) => JSON.stringify(path) === JSON.stringify(['A', 'B', 'C', 'D']))).toBe(true);
      expect(paths.some((path) => JSON.stringify(path) === JSON.stringify(['A', 'C', 'D']))).toBe(true);
    });

    test('returns empty array when no path exists', () => {
      const isolated = {
        nodes: ['A', 'X'],
        edges: [],
      };
      const paths = findAllPaths(isolated, 'A', 'X');
      expect(paths.length).toBe(0);
    });

    test('returns single node path when start equals end', () => {
      const paths = findAllPaths(testGraph, 'A', 'A');
      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0]).toEqual(['A']);
    });

    test('ignores failed edges when finding paths', () => {
      const modifiedGraph = removeEdge(testGraph, 4); // Remove A→C
      const paths = findAllPaths(modifiedGraph, 'A', 'D');
      expect(paths.length).toBe(1);
      expect(JSON.stringify(paths[0])).toBe(JSON.stringify(['A', 'B', 'C', 'D']));
    });
  });

  describe('removeEdge', () => {
    test('marks an edge as failed', () => {
      const modifiedGraph = removeEdge(testGraph, 1);
      expect(modifiedGraph.edges[0].status).toBe('failed');
    });

    test('does not affect other edges', () => {
      const modifiedGraph = removeEdge(testGraph, 1);
      expect(modifiedGraph.edges[1].status).toBe('active');
      expect(modifiedGraph.edges[2].status).toBe('active');
    });

    test('throws error for non-existent edge ID', () => {
      expect(() => removeEdge(testGraph, 999)).toThrow(
        "Edge '999' does not exist in the graph"
      );
    });
  });

  describe('removeNode', () => {
    test('marks all connected edges as failed', () => {
      const modifiedGraph = removeNode(testGraph, 'A');
      expect(modifiedGraph.edges[0].status).toBe('failed'); // A→B
      expect(modifiedGraph.edges[3].status).toBe('failed'); // A→C
    });

    test('only affects edges connected to removed node', () => {
      const modifiedGraph = removeNode(testGraph, 'A');
      expect(modifiedGraph.edges[1].status).toBe('active'); // B→C
      expect(modifiedGraph.edges[2].status).toBe('active'); // C→D
    });

    test('handles removal of nodes with no connections', () => {
      const graph = {
        nodes: ['A', 'X'],
        edges: [{ id: 1, from: 'A', to: 'A', status: 'active' }],
      };
      removeNode(graph, 'X');
      expect(graph.edges[0].status).toBe('active');
    });
  });

  describe('cloneGraph', () => {
    test('creates an independent deep copy', () => {
      const cloned = cloneGraph(testGraph);
      cloned.nodes[0] = 'X';
      cloned.edges[0].status = 'failed';

      expect(testGraph.nodes[0]).toBe('A');
      expect(testGraph.edges[0].status).toBe('active');
    });

    test('preserves graph structure', () => {
      const cloned = cloneGraph(testGraph);
      expect(cloned.nodes).toEqual(testGraph.nodes);
      expect(cloned.edges).toEqual(testGraph.edges);
    });

    test('handles nested objects correctly', () => {
      const complexGraph = {
        nodes: ['A', 'B'],
        edges: [{ id: 1, from: 'A', to: 'B', status: 'active', metadata: { weight: 5 } }],
      };
      const cloned = cloneGraph(complexGraph);
      cloned.edges[0].metadata.weight = 10;

      expect(complexGraph.edges[0].metadata.weight).toBe(5);
    });
  });
});
