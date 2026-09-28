import type { NestedRow, UnitHierarchy } from '@/shared/fold-subordinates';

// Origin: the accepted prototype used 60, and it is a tuning value. This graph holds thousands of
// entities of one type, and a rail of 2500 rows is not a rail. The remainder stands beside it.
const LIST_CAP = 60;

export interface EntityMatch {
  readonly id: string;
  readonly label: string;
  readonly degree: number;
}

interface RailEntityRow extends NestedRow, EntityMatch {
  readonly selected: boolean;
}

export interface RailOpenList {
  readonly type: string;
  readonly entities: readonly RailEntityRow[];
  readonly remainder: number;
}

interface ListReading {
  readonly openUnits: ReadonlySet<string>;
  readonly selectedId: string | null;
  readonly filtering: boolean;
  readonly whole: boolean;
}

export function openEntityList(
  hierarchy: UnitHierarchy,
  type: string,
  matches: readonly EntityMatch[],
  reading: ListReading,
): RailOpenList {
  // Departure: the hubs come first, and the name is the tie-break, so the same corpus gives the
  // same head on every open. The degree alone does not promise that. A folder keeps that order.
  const ranked = [...matches].sort(
    (one, two) => two.degree - one.degree || one.label.localeCompare(two.label),
  );
  const byId = new Map(ranked.map((match) => [match.id, match]));
  const members = ranked.map((match) => match.id);
  // Departure: with no filter the list is the folder tree, and the canvas still draws each node.
  // A filter lists every match on one level, and a choice reveals it.
  const lines = reading.filtering
    ? hierarchy.listed(members, reading.openUnits)
    : hierarchy.nested(members, reading.openUnits);
  const rows = lines.flatMap((line): RailEntityRow[] => {
    const match = byId.get(line.id);
    return match === undefined
      ? []
      : [
          {
            ...line,
            label: match.label,
            degree: match.degree,
            selected: line.id === reading.selectedId,
          },
        ];
  });

  const drawn = reading.whole ? rows : rows.slice(0, LIST_CAP);
  return { type, entities: drawn, remainder: rows.length - drawn.length };
}
