import { typeLabel } from '@/shared/type-label';

export interface TypeCount {
  readonly type: string;
  readonly label: string;
  /** The entities of the record with this type. The graph counts the same entities. */
  readonly total: number;
  /** Those that have a position, so the map draws them. */
  readonly onMap: number;
}

/** One count for each type of the record, in the order of the type words. */
export function typeCounts(
  entities: readonly { readonly type: string }[],
  onMap: readonly { readonly type: string }[],
): readonly TypeCount[] {
  const tally = new Map<string, { total: number; onMap: number }>();
  for (const one of entities) {
    const row = tally.get(one.type) ?? { total: 0, onMap: 0 };
    row.total += 1;
    tally.set(one.type, row);
  }
  for (const one of onMap) {
    const row = tally.get(one.type) ?? { total: 0, onMap: 0 };
    row.onMap += 1;
    tally.set(one.type, row);
  }
  return [...tally]
    .map(([type, row]) => ({ type, label: typeLabel(type), ...row }))
    .sort((one, two) => one.label.localeCompare(two.label));
}

// Origin: a vessel moves, and the record holds no fixed place for it. Another type with none on
// the map has no stated reason, so the line does not invent one.
const WHY_NONE: Readonly<Record<string, string>> = {
  vessel: 'a vessel moves, so the record holds no fixed position',
};

export interface TypeCountLine {
  readonly figure: string;
  readonly note: string | null;
}

export function typeCountLine(count: TypeCount): TypeCountLine {
  if (count.onMap === 0) {
    return {
      figure: `${String(count.total)}, none on the map`,
      note: WHY_NONE[count.type] ?? 'none has a known position',
    };
  }
  const without = count.total - count.onMap;
  return {
    figure: `${String(count.onMap)} of ${String(count.total)} on the map`,
    note:
      without === 0
        ? null
        : `${String(without)} ${without === 1 ? 'has' : 'have'} no known position`,
  };
}
