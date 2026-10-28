// The set of elements that take part in the live layout, and the strength of each node. The
// numbers that set a pull are in `variants.ts`, one block for each prototype.

import type { MultiDirectedGraph } from 'graphology';

import type { EdgeAttrs, NodeAttrs } from './model';
import type { RelationFamily } from './relation-families';

// Two nodes joined by many relations are bound by the sum of their weights, but the sum stops
// here: a pair with fifty relations must not fold the whole cluster onto one point.
export const PAIR_WEIGHT_CAP = 6;

export type FamilyWeights = Readonly<Record<RelationFamily, number>>;

/** The pull between two nodes, from the families of the relations that join them. */
export const pairWeight = (families: readonly RelationFamily[], weights: FamilyWeights): number =>
  Math.min(
    PAIR_WEIGHT_CAP,
    families.reduce((sum, family) => sum + weights[family], 0),
  );

export interface LayoutInput {
  /** The shown nodes that hold at least one shown link: the forces place these. */
  readonly nodes: readonly string[];
  /** The shown nodes with no shown link, ordered by type. They stand in a band at the edge, so
   * that no shown entity is left out of the picture. */
  readonly rest: readonly string[];
  /** One weighted link for each pair of nodes, whatever the direction or the count. */
  readonly links: readonly {
    readonly source: string;
    readonly target: string;
    readonly weight: number;
  }[];
  /** The sum of the weights of the links of each node in `nodes`. */
  readonly strength: ReadonlyMap<string, number>;
}

/** The nodes and the links that the layout reads after a filter. A hidden node leaves, with each
 * relation it holds; a relation of a type that is off pulls nothing. */
export function layoutInput(
  graph: MultiDirectedGraph<NodeAttrs, EdgeAttrs>,
  passes: (node: string) => boolean,
  hiddenRelations: ReadonlySet<string>,
  weights: FamilyWeights,
): LayoutInput {
  const shown = graph.filterNodes((node) => passes(node));
  const taking = new Set(shown);
  const pairs = new Map<string, { source: string; target: string; families: RelationFamily[] }>();
  graph.forEachEdge((_edge, attrs, source, target) => {
    if (source === target || hiddenRelations.has(attrs.relationType)) return;
    if (!taking.has(source) || !taking.has(target)) return;
    const key = source < target ? `${source}\u0000${target}` : `${target}\u0000${source}`;
    const held = pairs.get(key);
    if (held === undefined) pairs.set(key, { source, target, families: [attrs.type] });
    else held.families.push(attrs.type);
  });
  const links = [...pairs.values()].map(({ source, target, families }) => ({
    source,
    target,
    weight: pairWeight(families, weights),
  }));
  const strength = new Map<string, number>();
  for (const { source, target, weight } of links) {
    strength.set(source, (strength.get(source) ?? 0) + weight);
    strength.set(target, (strength.get(target) ?? 0) + weight);
  }
  const typeOf = (node: string): string => graph.getNodeAttribute(node, 'entityType');
  return {
    nodes: shown.filter((node) => strength.has(node)),
    rest: shown
      .filter((node) => !strength.has(node))
      .sort((one, two) => typeOf(one).localeCompare(typeOf(two)) || one.localeCompare(two)),
    links,
    strength,
  };
}
