/**
 * Graph utility functions for dependency analysis and cycle detection
 */

export class GraphUtils {
  
  /**
   * Create a directed graph from adjacency list
   */
  static createGraph(nodes = []) {
    const graph = new Map();
    nodes.forEach(node => {
      graph.set(node, new Set());
    });
    return graph;
  }

  /**
   * Add edge to graph
   */
  static addEdge(graph, from, to) {
    if (!graph.has(from)) {
      graph.set(from, new Set());
    }
    if (!graph.has(to)) {
      graph.set(to, new Set());
    }
    graph.get(from).add(to);
  }

  /**
   * Add bidirectional edge to graph
   */
  static addBidirectionalEdge(graph, nodeA, nodeB) {
    this.addEdge(graph, nodeA, nodeB);
    this.addEdge(graph, nodeB, nodeA);
  }

  /**
   * Detect cycles in directed graph using DFS
   */
  static detectCycles(graph) {
    const visited = new Set();
    const recursionStack = new Set();
    const cycles = [];

    const dfs = (node, path) => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart);
        cycle.push(node);
        return cycle;
      }

      if (visited.has(node)) {
        return null;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        const cycle = dfs(neighbor, [...path]);
        if (cycle) {
          return cycle;
        }
      }

      recursionStack.delete(node);
      return null;
    };

    // Check each unvisited node
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        const cycle = dfs(node, []);
        if (cycle) {
          cycles.push(cycle);
        }
      }
    }

    return cycles;
  }

  /**
   * Find all strongly connected components using Tarjan's algorithm
   */
  static findStronglyConnectedComponents(graph) {
    let index = 0;
    const stack = [];
    const indices = new Map();
    const lowLinks = new Map();
    const onStack = new Set();
    const components = [];

    const strongConnect = (node) => {
      indices.set(node, index);
      lowLinks.set(node, index);
      index++;
      stack.push(node);
      onStack.add(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!indices.has(neighbor)) {
          strongConnect(neighbor);
          lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(neighbor)));
        } else if (onStack.has(neighbor)) {
          lowLinks.set(node, Math.min(lowLinks.get(node), indices.get(neighbor)));
        }
      }

      if (lowLinks.get(node) === indices.get(node)) {
        const component = [];
        let w;
        do {
          w = stack.pop();
          onStack.delete(w);
          component.push(w);
        } while (w !== node);
        components.push(component);
      }
    };

    for (const node of graph.keys()) {
      if (!indices.has(node)) {
        strongConnect(node);
      }
    }

    return components;
  }

  /**
   * Topological sort using Kahn's algorithm
   */
  static topologicalSort(graph) {
    const inDegree = new Map();
    const result = [];
    const queue = [];

    // Initialize in-degree count
    for (const node of graph.keys()) {
      inDegree.set(node, 0);
    }

    // Calculate in-degrees
    for (const [node, neighbors] of graph.entries()) {
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, (inDegree.get(neighbor) || 0) + 1);
      }
    }

    // Find nodes with no incoming edges
    for (const [node, degree] of inDegree.entries()) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    // Process nodes
    while (queue.length > 0) {
      const node = queue.shift();
      result.push(node);

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        inDegree.set(neighbor, inDegree.get(neighbor) - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    // Check if all nodes were processed (no cycles)
    if (result.length !== graph.size) {
      return null; // Graph has cycles
    }

    return result;
  }

  /**
   * Find shortest path between two nodes using BFS
   */
  static findShortestPath(graph, start, end) {
    if (start === end) return [start];

    const queue = [[start]];
    const visited = new Set([start]);

    while (queue.length > 0) {
      const path = queue.shift();
      const node = path[path.length - 1];

      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (neighbor === end) {
          return [...path, neighbor];
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }

    return null; // No path found
  }

  /**
   * Check if graph is acyclic (DAG)
   */
  static isAcyclic(graph) {
    return this.detectCycles(graph).length === 0;
  }

  /**
   * Get all nodes reachable from a given node
   */
  static getReachableNodes(graph, startNode) {
    const reachable = new Set();
    const stack = [startNode];

    while (stack.length > 0) {
      const node = stack.pop();
      if (reachable.has(node)) continue;

      reachable.add(node);
      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!reachable.has(neighbor)) {
          stack.push(neighbor);
        }
      }
    }

    reachable.delete(startNode); // Remove start node from result
    return Array.from(reachable);
  }

  /**
   * Find all paths between two nodes
   */
  static findAllPaths(graph, start, end, maxDepth = 10) {
    const paths = [];

    const dfs = (currentPath, visited) => {
      const currentNode = currentPath[currentPath.length - 1];

      if (currentNode === end) {
        paths.push([...currentPath]);
        return;
      }

      if (currentPath.length >= maxDepth) {
        return; // Prevent infinite loops
      }

      const neighbors = graph.get(currentNode) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          currentPath.push(neighbor);
          dfs(currentPath, visited);
          currentPath.pop();
          visited.delete(neighbor);
        }
      }
    };

    const visited = new Set([start]);
    dfs([start], visited);
    return paths;
  }

  /**
   * Calculate node degrees (in-degree and out-degree)
   */
  static calculateNodeDegrees(graph) {
    const degrees = new Map();

    // Initialize degrees
    for (const node of graph.keys()) {
      degrees.set(node, { inDegree: 0, outDegree: 0 });
    }

    // Calculate degrees
    for (const [node, neighbors] of graph.entries()) {
      degrees.get(node).outDegree = neighbors.size;
      
      for (const neighbor of neighbors) {
        if (degrees.has(neighbor)) {
          degrees.get(neighbor).inDegree++;
        }
      }
    }

    return degrees;
  }

  /**
   * Find nodes with no dependencies (sources)
   */
  static findSourceNodes(graph) {
    const degrees = this.calculateNodeDegrees(graph);
    const sources = [];

    for (const [node, degree] of degrees.entries()) {
      if (degree.inDegree === 0) {
        sources.push(node);
      }
    }

    return sources;
  }

  /**
   * Find nodes with no dependents (sinks)
   */
  static findSinkNodes(graph) {
    const degrees = this.calculateNodeDegrees(graph);
    const sinks = [];

    for (const [node, degree] of degrees.entries()) {
      if (degree.outDegree === 0) {
        sinks.push(node);
      }
    }

    return sinks;
  }

  /**
   * Create dependency graph from rules
   */
  static createDependencyGraphFromRules(tasks, rules) {
    const graph = this.createGraph(tasks.map(task => task.TaskID || task.id));

    rules.forEach(rule => {
      switch (rule.type) {
        case 'coRun':
          // Co-run creates bidirectional dependencies
          if (rule.tasks && Array.isArray(rule.tasks)) {
            for (let i = 0; i < rule.tasks.length; i++) {
              for (let j = i + 1; j < rule.tasks.length; j++) {
                this.addBidirectionalEdge(graph, rule.tasks[i], rule.tasks[j]);
              }
            }
          }
          break;

        case 'sequence':
          // Sequence creates directed dependencies
          if (rule.tasks && Array.isArray(rule.tasks)) {
            for (let i = 0; i < rule.tasks.length - 1; i++) {
              this.addEdge(graph, rule.tasks[i], rule.tasks[i + 1]);
            }
          }
          break;

        case 'prerequisite':
          // Prerequisite creates directed dependency
          if (rule.prerequisite && rule.dependent) {
            this.addEdge(graph, rule.prerequisite, rule.dependent);
          }
          break;
      }
    });

    return graph;
  }

  /**
   * Analyze graph structure and return statistics
   */
  static analyzeGraph(graph) {
    const nodeCount = graph.size;
    const edgeCount = Array.from(graph.values()).reduce((sum, neighbors) => sum + neighbors.size, 0);
    const degrees = this.calculateNodeDegrees(graph);
    const sources = this.findSourceNodes(graph);
    const sinks = this.findSinkNodes(graph);
    const cycles = this.detectCycles(graph);
    const components = this.findStronglyConnectedComponents(graph);

    // Calculate average degrees
    const totalInDegree = Array.from(degrees.values()).reduce((sum, deg) => sum + deg.inDegree, 0);
    const totalOutDegree = Array.from(degrees.values()).reduce((sum, deg) => sum + deg.outDegree, 0);

    return {
      nodeCount,
      edgeCount,
      averageInDegree: nodeCount > 0 ? totalInDegree / nodeCount : 0,
      averageOutDegree: nodeCount > 0 ? totalOutDegree / nodeCount : 0,
      sourceNodes: sources,
      sinkNodes: sinks,
      hasCycles: cycles.length > 0,
      cycleCount: cycles.length,
      cycles: cycles,
      stronglyConnectedComponents: components,
      isConnected: components.length === 1,
      density: nodeCount > 1 ? edgeCount / (nodeCount * (nodeCount - 1)) : 0
    };
  }

  /**
   * Convert graph to DOT format for visualization
   */
  static toDotFormat(graph, graphName = 'dependency_graph') {
    let dot = `digraph ${graphName} {\n`;
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box];\n\n';

    // Add nodes
    for (const node of graph.keys()) {
      dot += `  "${node}";\n`;
    }

    dot += '\n';

    // Add edges
    for (const [node, neighbors] of graph.entries()) {
      for (const neighbor of neighbors) {
        dot += `  "${node}" -> "${neighbor}";\n`;
      }
    }

    dot += '}\n';
    return dot;
  }
} 