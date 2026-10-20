import type { MultiDirectedGraph } from 'graphology';

import type { EdgeAttrs, NodeAttrs } from './model';

export interface ShownOfTotal {
  readonly shown: number;
  readonly total: number;
}

export interface ShownCounts {
  readonly entities: ShownOfTotal;
  readonly relations: ShownOfTotal;
  readonly byType: ReadonlyMap<string, ShownOfTotal>;
}

/** What the drawing shows against what the record holds. A relation is shown while both of its
 * ends are shown. */
export function countShown(
  graph: MultiDirectedGraph<NodeAttrs, EdgeAttrs>,
  shown: ReadonlySet<string>,
): ShownCounts {
  const tally = new Map<string, { shown: number; total: number }>();
  graph.forEachNode((node, attrs) => {
    const row = tally.get(attrs.entityType) ?? { shown: 0, total: 0 };
    row.total += 1;
    if (shown.has(node)) row.shown += 1;
    tally.set(attrs.entityType, row);
  });
  let relationsShown = 0;
  graph.forEachEdge((_edge, _attrs, source, target) => {
    if (shown.has(source) && shown.has(target)) relationsShown += 1;
  });
  return {
    entities: { shown: shown.size, total: graph.order },
    relations: { shown: relationsShown, total: graph.size },
    byType: tally,
  };
}
