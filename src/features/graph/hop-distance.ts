// A selection marks the graph around itself by distance, so the canvas can draw the near ring and
// the far ring in two different ways.

import type { MultiDirectedGraph } from 'graphology';

import type { EdgeAttrs, NodeAttrs } from './model';

/** How far a selection reaches. Two hops. */
export const REACH = 2;

/**
 * Each node the walk reaches, with its distance: 0 for a seed, then 1 and 2. The walk steps
 * through a relation that `shown` keeps, to a node in `passes`, and no further than `REACH`.
 * The walk does not go through a node that the filter excludes.
 */
export function hopDistances(
  graph: MultiDirectedGraph<NodeAttrs, EdgeAttrs>,
  seeds: readonly string[],
  passes: ReadonlySet<string>,
  shown: (edge: string) => boolean,
): ReadonlyMap<string, number> {
  const hops = new Map<string, number>();
  let frontier = seeds.filter((seed) => graph.hasNode(seed));
  for (const seed of frontier) hops.set(seed, 0);
  for (let hop = 1; hop <= REACH; hop += 1) {
    const next: string[] = [];
    for (const node of frontier) {
      graph.forEachEdge(node, (edge, _attrs, source, target) => {
        const neighbour = source === node ? target : source;
        if (!shown(edge) || !passes.has(neighbour) || hops.has(neighbour)) return;
        hops.set(neighbour, hop);
        next.push(neighbour);
      });
    }
    frontier = next;
  }
  return hops;
}

/** How the canvas draws a relation between two nodes of the walk. */
export type EdgeRing = 'lit' | 'faint' | 'dim';

/** A relation from a seed to the first ring is lit, and a relation from the first ring to the
 * second is faint. A relation between two seeds is lit, because it is a selected relation. A
 * relation inside one ring, or between a seed and the second ring, is not a step of the walk. */
export const edgeRing = (one: number, two: number): EdgeRing => {
  if (one + two === 0) return 'lit';
  if (Math.abs(one - two) !== 1) return 'dim';
  return one + two === 1 ? 'lit' : 'faint';
};
