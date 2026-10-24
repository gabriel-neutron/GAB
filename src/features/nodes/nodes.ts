import type { CriticalNode } from '@gab/release/site-release';

export interface NodeGroups {
  readonly retained: readonly CriticalNode[];
  readonly others: readonly CriticalNode[];
  /** The count sentence of the page. */
  readonly summary: string;
}

/** The words of a claim without the name of the node of the row, when the claim starts with it. */
export function withoutNodeName(text: string, label: string): string {
  const start = `${label}: `;
  return text.startsWith(start) && text.length > start.length ? text.slice(start.length) : text;
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
        ? 'This release has no candidate node: the operator has not ticked a condition yet.'
        : `${String(nodes.length)} candidate nodes, ${String(retained.length)} retained.`,
  };
}
