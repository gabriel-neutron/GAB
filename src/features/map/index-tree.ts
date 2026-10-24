import type { NestedRow } from '@/shared/fold-subordinates';
import { nameHoldsQuery } from '@/shared/name-match';

import { entitiesOfType, type GeoEntity, type Projection, type RailLegend } from './projection';

/** One line of the open list of a type: the entity, and where it stands in its folder. */
export interface IndexLine extends NestedRow {
  readonly entity: GeoEntity;
  readonly selected: boolean;
}

// Departure: with no search the list is the folder tree, and the map still draws each point. A
// search lists every match on one level, folded or not, and a choice reveals it.
export function indexLines(
  projection: Projection,
  legend: RailLegend,
  type: string,
  query: string,
  selectedId: string | null,
): readonly IndexLine[] {
  const members = entitiesOfType(projection, type)
    .filter((entity) => nameHoldsQuery(entity.label, query))
    .map((entity) => entity.id);
  const rows =
    query.trim() === ''
      ? projection.hierarchy.nested(members, legend.openUnits)
      : projection.hierarchy.listed(members, legend.openUnits);
  return rows.flatMap((row) => {
    const entity = projection.byId.get(row.id);
    return entity === undefined ? [] : [{ ...row, entity, selected: row.id === selectedId }];
  });
}
