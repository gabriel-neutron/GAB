// The list and the description of the drawing read one view, so they are one job and stay in step.

import type { MultiDirectedGraph } from 'graphology';

import type { RelationWords } from '@/shared/relation-words';

import type { EdgeAttrs, NodeAttrs } from './model';
import type { GraphSelection } from './selection';
import type { ShownCounts } from './shown-counts';
import { isShown } from './type-filter';

/** What the canvas draws, as three switches. The text view lists what the canvas draws. */
export interface TextViewRules {
  readonly hiddenTypes: ReadonlySet<string>;
  readonly showUnplaced: boolean;
  readonly hiddenRelationTypes: ReadonlySet<string>;
}

export interface TextRow {
  readonly entityId: string;
  readonly label: string;
  readonly relationId: string;
  /** The words of the relation, read from the selected element. */
  readonly relation: string;
  /** `out`: the selected element is the source. */
  readonly direction: 'out' | 'in';
}

export interface TextView {
  readonly kind: GraphSelection['kind'];
  readonly name: string;
  readonly rows: readonly TextRow[];
}

type Graph = MultiDirectedGraph<NodeAttrs, EdgeAttrs>;

/**
 * The selected element and the elements next to it, as a list. An entity lists its neighbours
 * through the relations that the switches keep, drawn or not: a focus draws a part of them. A relation lists its two ends.
 */
export function deriveTextView(
  graph: Graph,
  selection: GraphSelection | null,
  rules: TextViewRules,
  wordsOf: (type: string) => RelationWords,
): TextView | null {
  if (selection === null) return null;

  if (selection.kind === 'relation') {
    if (!graph.hasEdge(selection.id)) return null;
    const source = graph.source(selection.id);
    const target = graph.target(selection.id);
    const from = graph.getNodeAttribute(source, 'label');
    const to = graph.getNodeAttribute(target, 'label');
    const words = wordsOf(graph.getEdgeAttribute(selection.id, 'relationType'));
    return {
      kind: 'relation',
      name: `${from} ${words.label} ${to}`,
      rows: [
        {
          entityId: source,
          label: from,
          relationId: selection.id,
          relation: words.label,
          direction: 'out',
        },
        {
          entityId: target,
          label: to,
          relationId: selection.id,
          relation: words.inverseLabel,
          direction: 'in',
        },
      ],
    };
  }

  if (!graph.hasNode(selection.id)) return null;
  const rows: TextRow[] = [];
  graph.forEachEdge(selection.id, (edge, attrs, source, target) => {
    if (rules.hiddenRelationTypes.has(attrs.relationType) || source === target) return;
    const out = source === selection.id;
    const other = out ? target : source;
    const otherAttrs = graph.getNodeAttributes(other);
    if (!isShown(otherAttrs, rules.hiddenTypes, rules.showUnplaced)) return;
    const words = wordsOf(attrs.relationType);
    rows.push({
      entityId: other,
      label: otherAttrs.label,
      relationId: edge,
      relation: out ? words.label : words.inverseLabel,
      direction: out ? 'out' : 'in',
    });
  });
  rows.sort(
    (one, two) =>
      one.label.localeCompare(two.label) || one.relationId.localeCompare(two.relationId),
  );
  return { kind: 'entity', name: graph.getNodeAttribute(selection.id, 'label'), rows };
}

export const plural = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

const part = (
  count: { readonly shown: number; readonly total: number },
  one: string,
  many: string,
): string => `${String(count.shown)} of ${plural(count.total, one, many)}`;

/** The name of the drawing for a reader who cannot see it: the counts, then the selection. */
export function describeDrawing(
  counts: Pick<ShownCounts, 'entities' | 'relations'>,
  view: TextView | null,
): string {
  const head = `Graph of ${part(counts.entities, 'entity', 'entities')} and ${part(counts.relations, 'relation', 'relations')}.`;
  return view === null
    ? `${head} Nothing is selected.`
    : `${head} Selected: ${view.name}, with ${plural(view.rows.length, 'neighbour', 'neighbours')}.`;
}
