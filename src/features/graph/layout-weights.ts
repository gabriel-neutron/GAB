// The weights of the live layout, and the set of elements that take part in it. One place holds
// each number, so a change of the picture is a change of this file only.

import type { MultiDirectedGraph } from 'graphology';

import type { EdgeAttrs, NodeAttrs } from './model';
import type { RelationFamily } from './relation-families';

// A heavy weight pulls two nodes closer. Ownership and flag are the structure of a group, so they
// bind the hardest. A designation is a legal fact about one node and binds less. A transfer is an
// event between two nodes that stay apart in the rest of the graph, so it binds weakly. An
// unplaced family (`other`) is the base of 1: it is the unit that the others scale.
export const FAMILY_WEIGHT: Readonly<Record<RelationFamily, number>> = {
  ownership: 3,
  designation: 2,
  operation: 2,
  transfer: 1.5,
  other: 1,
};

// Two nodes joined by many relations are bound by the sum of their weights, but the sum stops
// here: a pair with fifty relations must not fold the whole cluster onto one point.
export const PAIR_WEIGHT_CAP = 6;

/** The pull between two nodes, from the families of the relations that join them. */
export const pairWeight = (families: readonly RelationFamily[]): number =>
  Math.min(
    PAIR_WEIGHT_CAP,
    families.reduce((sum, family) => sum + FAMILY_WEIGHT[family], 0),
  );

export interface LayoutInput {
  /** The nodes that take part: those that pass the filter. */
  readonly nodes: readonly string[];
  /** One weighted link for each pair of nodes, whatever the direction or the count. */
  readonly links: readonly {
    readonly source: string;
    readonly target: string;
    readonly weight: number;
  }[];
}

/** The nodes and the links that the layout reads after a filter. A hidden node leaves, with each
 * relation it holds; a relation of a type that is off pulls nothing. */
export function layoutInput(
  graph: MultiDirectedGraph<NodeAttrs, EdgeAttrs>,
  passes: (node: string) => boolean,
  hiddenRelations: ReadonlySet<string>,
): LayoutInput {
  const nodes = graph.filterNodes((node) => passes(node));
  const taking = new Set(nodes);
  const pairs = new Map<string, { source: string; target: string; families: RelationFamily[] }>();
  graph.forEachEdge((_edge, attrs, source, target) => {
    if (source === target || hiddenRelations.has(attrs.relationType)) return;
    if (!taking.has(source) || !taking.has(target)) return;
    const key = source < target ? `${source}\u0000${target}` : `${target}\u0000${source}`;
    const held = pairs.get(key);
    if (held === undefined) pairs.set(key, { source, target, families: [attrs.type] });
    else held.families.push(attrs.type);
  });
  return {
    nodes,
    links: [...pairs.values()].map(({ source, target, families }) => ({
      source,
      target,
      weight: pairWeight(families),
    })),
  };
}
