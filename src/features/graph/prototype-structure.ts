/**
 * PROTOTYPE — throwaway. The three macro reads the analyst asked for.
 *
 * Communities, cut points and isolates, all computed in the browser and all written by hand.
 * No library is added for them: `graphology-communities-louvain` and the metrics package would
 * each be a dependency this prototype cannot justify, and the two algorithms below are short.
 *
 * Both are deterministic. Label propagation walks the nodes in insertion order, never in a
 * shuffled one, so the same graph gives the same colours on every open. That property is on
 * purpose: it is the contrast with the force layout, which has no such guarantee. See #35.
 */

/**
 * Only the four topology reads are named, so this file never depends on the attribute shape of
 * the graph and never fights the generic parameters of graphology.
 */
export interface Topology {
  forEachNode(callback: (node: string) => void): void;
  forEachNeighbor(node: string, callback: (neighbour: string) => void): void;
  neighbors(node: string): string[];
  degree(node: string): number;
}

export interface Structure {
  /** Node identifier to community index. */
  readonly community: ReadonlyMap<string, number>;
  readonly communityCount: number;
  /** The size of each community, largest first, as `[index, size]`. */
  readonly communitySizes: readonly (readonly [number, number])[];
  /** Every node whose removal splits its component. At this density there are thousands. */
  readonly cutPoints: ReadonlySet<string>;
  /**
   * A cut point that detaches a piece worth looking at, and the size of the smaller side.
   *
   * **This distinction is a finding.** At 10k entities and 25k relations the average degree is
   * 2.5, and a plain articulation point is not rare — most of them detach one leaf. Painting all
   * of them fills the picture with orange and reads as noise. Ranking them by the smaller side
   * they separate is what turns "a cut point" into "a bridge the analyst wants".
   */
  readonly bridges: ReadonlyMap<string, number>;
  /** Degree zero. */
  readonly isolates: readonly string[];
  readonly maxDegree: number;
  readonly ms: number;
}

/**
 * Label propagation. Each node takes the commonest label among its neighbours; ties break on
 * the lowest label, which is what makes it deterministic.
 */
function propagateLabels(graph: Topology, passes: number): Map<string, number> {
  const label = new Map<string, number>();
  const order: string[] = [];
  let next = 0;
  graph.forEachNode((node) => {
    label.set(node, next);
    next += 1;
    order.push(node);
  });

  for (let pass = 0; pass < passes; pass += 1) {
    let changed = false;
    for (const node of order) {
      const tally = new Map<number, number>();
      graph.forEachNeighbor(node, (neighbour) => {
        const value = label.get(neighbour);
        if (value === undefined) return;
        tally.set(value, (tally.get(value) ?? 0) + 1);
      });
      if (tally.size === 0) continue;

      let best = -1;
      let bestCount = -1;
      for (const [candidate, count] of tally) {
        if (count > bestCount || (count === bestCount && candidate < best)) {
          best = candidate;
          bestCount = count;
        }
      }
      if (best !== -1 && label.get(node) !== best) {
        label.set(node, best);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return label;
}

/**
 * Articulation points, by Tarjan's rule, iterative.
 *
 * A recursive walk overflows the stack at ten thousand nodes, which is the volume this
 * prototype exists to test, so the depth-first search carries its own stack.
 */
function findCutPoints(
  graph: Topology,
  order: number,
): { cut: Set<string>; severance: Map<string, number> } {
  const cut = new Set<string>();
  // For each cut point, the largest "smaller side" it detaches.
  const severance = new Map<string, number>();
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const subtree = new Map<string, number>();
  let timer = 0;

  const noteSeverance = (node: string, side: number): void => {
    const weight = Math.min(side, order - side);
    if (weight > (severance.get(node) ?? 0)) severance.set(node, weight);
  };

  graph.forEachNode((root) => {
    if (disc.has(root)) return;

    let rootChildren = 0;
    // Each frame is a node and the index of the neighbour it will look at next.
    const stack: { node: string; neighbours: string[]; next: number }[] = [];

    disc.set(root, timer);
    low.set(root, timer);
    timer += 1;
    parent.set(root, null);
    subtree.set(root, 1);
    stack.push({ node: root, neighbours: graph.neighbors(root), next: 0 });

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame === undefined) break;

      if (frame.next < frame.neighbours.length) {
        const neighbour = frame.neighbours[frame.next];
        frame.next += 1;
        if (neighbour === undefined || neighbour === frame.node) continue;

        if (!disc.has(neighbour)) {
          parent.set(neighbour, frame.node);
          if (frame.node === root) rootChildren += 1;
          disc.set(neighbour, timer);
          low.set(neighbour, timer);
          timer += 1;
          subtree.set(neighbour, 1);
          stack.push({ node: neighbour, neighbours: graph.neighbors(neighbour), next: 0 });
        } else if (neighbour !== parent.get(frame.node)) {
          const seen = disc.get(neighbour) ?? 0;
          low.set(frame.node, Math.min(low.get(frame.node) ?? 0, seen));
        }
        continue;
      }

      stack.pop();
      const size = subtree.get(frame.node) ?? 1;
      const above = parent.get(frame.node) ?? null;
      if (above !== null) {
        subtree.set(above, (subtree.get(above) ?? 1) + size);
        const childLow = low.get(frame.node) ?? 0;
        low.set(above, Math.min(low.get(above) ?? 0, childLow));
        if (above !== root && childLow >= (disc.get(above) ?? 0)) {
          cut.add(above);
          // Removing `above` detaches exactly this subtree.
          noteSeverance(above, size);
        } else if (above === root && rootChildren > 1) {
          noteSeverance(above, size);
        }
      }
    }

    // The root is a cut point only when it carries two or more children in the search tree.
    if (rootChildren > 1) cut.add(root);
  });

  return { cut, severance };
}

export function analyseStructure(graph: Topology): Structure {
  const started = performance.now();

  const raw = propagateLabels(graph, 8);

  // Renumber the labels so that the index is dense and the largest community is index 0.
  const sizes = new Map<number, number>();
  for (const value of raw.values()) sizes.set(value, (sizes.get(value) ?? 0) + 1);
  const ranked = [...sizes.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const renumber = new Map<number, number>();
  ranked.forEach(([original], index) => renumber.set(original, index));

  const community = new Map<string, number>();
  for (const [node, value] of raw) community.set(node, renumber.get(value) ?? 0);

  const isolates: string[] = [];
  let maxDegree = 0;
  let order = 0;
  graph.forEachNode((node) => {
    order += 1;
    const degree = graph.degree(node);
    if (degree === 0) isolates.push(node);
    if (degree > maxDegree) maxDegree = degree;
  });

  const { cut: cutPoints, severance } = findCutPoints(graph, order);

  // A cut point that detaches one leaf is arithmetic, not a finding. The floor scales with the
  // graph, so the same rule holds at one thousand entities and at twenty-five thousand.
  const floor = Math.max(5, Math.round(order / 400));
  const bridges = new Map<string, number>();
  for (const [node, weight] of severance) {
    if (weight >= floor && cutPoints.has(node)) bridges.set(node, weight);
  }

  return {
    community,
    communityCount: ranked.length,
    communitySizes: ranked.map(([original, size], index) => [
      renumber.get(original) ?? index,
      size,
    ]),
    cutPoints,
    bridges,
    isolates,
    maxDegree,
    ms: performance.now() - started,
  };
}
