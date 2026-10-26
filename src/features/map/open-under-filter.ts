import { nameHoldsQuery } from '@/shared/name-match';

import type { GeoEntity, RailLegend } from './projection';

// Departure: a filter opens each type that is on and holds a match, and it never writes the
// folds the analyst chose. So those folds come back when the filter is empty again.
export function openTypesUnderFilter(
  legend: RailLegend,
  entities: readonly GeoEntity[],
  chosen: readonly string[],
  query: string,
): readonly string[] {
  if (query.trim() === '') return chosen;
  const matched = new Set<string>();
  for (const entity of entities) {
    if (legend.drawnTypes.has(entity.type) && nameHoldsQuery(entity.label, query)) {
      matched.add(entity.type);
    }
  }
  const opened = legend.facets
    .map(({ facet }) => facet.type)
    .filter((type) => matched.has(type) && !chosen.includes(type));
  return [...chosen, ...opened];
}
