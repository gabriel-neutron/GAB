export interface Topology {
  forEachNode(cb: (node: string) => void): void;
  neighbors(node: string): string[];
  degree(node: string): number;
}

export interface TopologyLink {
  readonly source: string;
  readonly target: string;
}

// The walk needs the simple graph, and the degree needs the multiplicity. A self-loop adds no
// neighbour and no degree, so a node with only a self-loop stays an isolate. A parallel relation
// adds one neighbour, and one degree at each end.
export function topologyOf(nodes: Iterable<string>, links: Iterable<TopologyLink>): Topology {
  const adjacency = new Map<string, Set<string>>();
  const degrees = new Map<string, number>();
  for (const id of nodes) {
    adjacency.set(id, new Set<string>());
    degrees.set(id, 0);
  }

  for (const link of links) {
    if (link.source === link.target) continue;
    const source = adjacency.get(link.source);
    const target = adjacency.get(link.target);
    if (source === undefined || target === undefined) continue;
    source.add(link.target);
    target.add(link.source);
    degrees.set(link.source, (degrees.get(link.source) ?? 0) + 1);
    degrees.set(link.target, (degrees.get(link.target) ?? 0) + 1);
  }

  return {
    forEachNode: (cb) => {
      for (const id of adjacency.keys()) cb(id);
    },
    neighbors: (node) => [...(adjacency.get(node) ?? [])],
    degree: (node) => degrees.get(node) ?? 0,
  };
}

export interface Structure {
  readonly community: ReadonlyMap<string, number>;
  readonly isolates: readonly string[];
  readonly largestDegree: number;
}

// A round that changes no label ends the walk, so this ceiling holds only a corpus whose labels
// never settle. Twenty rounds of ten thousand nodes cost a small part of the 51 ms of the
// analysis.
const MAX_ROUNDS = 20;

// The fallback is never used: every index below comes from the loop that filled the array.
// `noUncheckedIndexedAccess` is on, and this keeps each read on one line.
const numberAt = (values: readonly number[], index: number): number => values[index] ?? 0;

function bestLabel(labels: readonly number[], neighbours: readonly number[], own: number): number {
  if (neighbours.length === 0) return own;

  const counts = new Map<number, number>();
  for (const neighbour of neighbours) {
    const label = numberAt(labels, neighbour);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  let best = own;
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount || (count === bestCount && label < best)) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

export function analyseStructure(graph: Topology): Structure {
  // The nodes in insertion order. Every array below is indexed by this order, so one corpus gives
  // the same communities on every open.
  const nodes: string[] = [];
  graph.forEachNode((node) => nodes.push(node));
  const order = nodes.length;

  const numberOf = new Map<string, number>();
  nodes.forEach((node, index) => numberOf.set(node, index));

  const adjacency: number[][] = nodes.map((node) => {
    const list: number[] = [];
    for (const neighbour of graph.neighbors(node)) {
      const index = numberOf.get(neighbour);
      if (index !== undefined) list.push(index);
    }
    return list;
  });
  const neighboursOf = (index: number): readonly number[] => adjacency[index] ?? [];

  const degrees = nodes.map((node) => graph.degree(node));

  const labels = nodes.map((_node, index) => index);
  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    let changed = false;
    for (let node = 0; node < order; node += 1) {
      const next = bestLabel(labels, neighboursOf(node), numberAt(labels, node));
      if (next !== numberAt(labels, node)) {
        labels[node] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }

  // A tie between two communities of one size goes to the one that holds the earlier node, which
  // keeps the numbering deterministic.
  const members = new Map<number, number[]>();
  labels.forEach((label, node) => {
    const held = members.get(label);
    if (held === undefined) members.set(label, [node]);
    else held.push(node);
  });

  const ranked = [...members.values()].sort(
    (a, b) => b.length - a.length || numberAt(a, 0) - numberAt(b, 0),
  );
  const community = new Map<string, number>();
  ranked.forEach((group, rank) => {
    for (const node of group) {
      const name = nodes[node];
      if (name !== undefined) community.set(name, rank);
    }
  });

  return {
    community,
    isolates: nodes.filter((_node, index) => numberAt(degrees, index) === 0),
    largestDegree: degrees.reduce((largest, degree) => Math.max(largest, degree), 0),
  };
}
