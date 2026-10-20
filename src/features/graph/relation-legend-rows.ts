import { FAMILIES, familyOf, type FamilyLook, type RelationFamily } from './relation-families';
import type { ShownOfTotal } from './shown-counts';

export interface LegendType extends ShownOfTotal {
  readonly type: string;
  readonly label: string;
  /** False while the filter switches the type off. */
  readonly on: boolean;
}

export interface LegendFamily extends ShownOfTotal {
  readonly key: RelationFamily;
  readonly look: FamilyLook;
  readonly types: readonly LegendType[];
}

/** The legend of the drawing: each family that holds a relation, with its types and the count of
 * each. It reads the same counts as the line above the island, so the two never disagree. */
export function deriveLegend(
  byRelationType: ReadonlyMap<string, ShownOfTotal>,
  hiddenRelationTypes: ReadonlySet<string>,
  wordsOf: (type: string) => { readonly label: string },
): readonly LegendFamily[] {
  const grouped = new Map<RelationFamily, LegendType[]>();
  for (const [type, count] of byRelationType) {
    const row: LegendType = {
      type,
      label: wordsOf(type).label,
      shown: count.shown,
      total: count.total,
      on: !hiddenRelationTypes.has(type),
    };
    const key = familyOf(type);
    const held = grouped.get(key);
    if (held === undefined) grouped.set(key, [row]);
    else held.push(row);
  }

  const legend: LegendFamily[] = [];
  for (const look of FAMILIES) {
    const types = grouped.get(look.key);
    if (types === undefined) continue;
    types.sort((one, two) => one.label.localeCompare(two.label));
    legend.push({
      key: look.key,
      look,
      types,
      shown: types.reduce((sum, row) => sum + row.shown, 0),
      total: types.reduce((sum, row) => sum + row.total, 0),
    });
  }
  return legend;
}
