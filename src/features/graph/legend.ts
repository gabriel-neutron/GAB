import { GLYPHS } from './glyphs';
import { familyOf, FAMILIES, type RelationFamily } from './relation-families';
import type { ShownCounts } from './shown-counts';

export interface LegendType {
  readonly key: string;
  readonly count: number;
}

export interface LegendFamily {
  readonly key: RelationFamily;
  readonly count: number;
}

export interface Legend {
  readonly types: readonly LegendType[];
  readonly families: readonly LegendFamily[];
}

/** The types and the families the drawing shows, in the order of the glyph table and of the
 * families. A type or a family with nothing in view is absent. A type the glyph table does not
 * hold draws as `unknown`, so it counts there. */
export function legendOf(counts: ShownCounts): Legend {
  const byGlyph = new Map<string, number>();
  for (const [type, { shown }] of counts.byType) {
    const key = type in GLYPHS ? type : 'unknown';
    byGlyph.set(key, (byGlyph.get(key) ?? 0) + shown);
  }
  const byFamily = new Map<RelationFamily, number>();
  for (const [type, { shown }] of counts.byRelationType) {
    const key = familyOf(type);
    byFamily.set(key, (byFamily.get(key) ?? 0) + shown);
  }
  return {
    types: Object.keys(GLYPHS)
      .map((key) => ({ key, count: byGlyph.get(key) ?? 0 }))
      .filter(({ count }) => count > 0),
    families: FAMILIES.map(({ key }) => ({ key, count: byFamily.get(key) ?? 0 })).filter(
      ({ count }) => count > 0,
    ),
  };
}

export interface GreyCounts {
  /** Nodes with no relation in view. */
  readonly isolates: number;
  /** Nodes that stand on the ring with no place. A node with no place counts here only. */
  readonly unplaced: number;
}

/** The nodes the canvas paints grey: the legend must name both greys. */
export function greyCountsOf(
  nodes: Iterable<{ readonly isolate: boolean; readonly unplaced: boolean }>,
): GreyCounts {
  let isolates = 0;
  let unplaced = 0;
  for (const node of nodes) {
    if (node.unplaced) unplaced += 1;
    else if (node.isolate) isolates += 1;
  }
  return { isolates, unplaced };
}
