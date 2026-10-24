// A selection marks the graph around itself by distance, so the canvas can draw the near ring and
// the far ring in two different ways.

import type { MultiDirectedGraph } from 'graphology';

import type { EdgeAttrs, NodeAttrs } from './model';

/** How far a selection reaches. Two hops. */
export const REACH = 2;

/**
 * Each node the walk reaches, with its distance: 0 for a seed, then 1 and 2. The walk steps
 * through a relation that `shown` keeps, to a node in `passes`, and no further than `REACH`.
 * Out of consideration is out of reach, so a node the filter excludes carries no neighbourhood.
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
