export interface Topology {
  forEachNode(cb: (node: string) => void): void;
  degree(node: string): number;
}

export interface TopologyLink {
  readonly source: string;
  readonly target: string;
}

// The degree needs the multiplicity. A self-loop adds no degree, so a node with only a self-loop
// stays an isolate. A parallel relation adds one degree at each end.
export function topologyOf(nodes: Iterable<string>, links: Iterable<TopologyLink>): Topology {
  const degrees = new Map<string, number>();
  for (const id of nodes) degrees.set(id, 0);

  for (const link of links) {
    if (link.source === link.target) continue;
    const source = degrees.get(link.source);
    const target = degrees.get(link.target);
    if (source === undefined || target === undefined) continue;
    degrees.set(link.source, source + 1);
    degrees.set(link.target, target + 1);
  }

  return {
    forEachNode: (cb) => {
      for (const id of degrees.keys()) cb(id);
    },
    degree: (node) => degrees.get(node) ?? 0,
  };
}

export interface Structure {
  readonly isolates: readonly string[];
  readonly largestDegree: number;
}

export function analyseStructure(graph: Topology): Structure {
  const nodes: string[] = [];
  graph.forEachNode((node) => nodes.push(node));

  return {
    isolates: nodes.filter((node) => graph.degree(node) === 0),
    largestDegree: nodes.reduce((largest, node) => Math.max(largest, graph.degree(node)), 0),
  };
}
