import type { CriticalNode } from '@gab/release/site-release';

export interface NodeGroups {
  readonly retained: readonly CriticalNode[];
  readonly others: readonly CriticalNode[];
  /** The count sentence of the page. */
  readonly summary: string;
}

/** The retained nodes first, as the release orders them inside each group. */
export function groupNodes(nodes: readonly CriticalNode[]): NodeGroups {
  const retained = nodes.filter((one) => one.retained);
  const others = nodes.filter((one) => !one.retained);
  return {
    retained,
    others,
    summary:
      nodes.length === 0
        ? 'This release has no candidate node.'
        : `${String(nodes.length)} candidate nodes, ${String(retained.length)} retained.`,
  };
}
