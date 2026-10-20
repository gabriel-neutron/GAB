import { z } from 'zod';

// Placeholder scope words: the operator rewrites them. They are the only place that states the
// scope, and a release copies them into its file manifest, so an old release keeps its own words.
const SCOPE = {
  covers:
    'The record holds the entities, the relations and the facts that GAB read in public documents and that were then reviewed. Each fact names its sources.',
  excludes:
    'The record is not complete. It does not cover each vessel, company, person or unit, and it does not cover a source that GAB has not read.',
  absence: 'An absence means "not yet in the record". It does not mean "not true".',
};

export const coverageShape = z.object({
  entities: z.number().int().nonnegative(),
  byType: z.array(z.object({ type: z.string(), count: z.number().int().positive() })),
  sources: z.number().int().nonnegative(),
  scope: z.object({ covers: z.string(), excludes: z.string(), absence: z.string() }),
});

/** What the record covers: the count of entities in total and for each type, the count of
 * sources, and the fixed words of the scope. */
export type Coverage = z.output<typeof coverageShape>;

/** The coverage of a record, from the type of each entity and the count of its sources. The
 * types come with the largest count first, then by name. */
export const coverageOf = (entityTypes: readonly string[], sources: number): Coverage => {
  const counts = new Map<string, number>();
  for (const type of entityTypes) counts.set(type, (counts.get(type) ?? 0) + 1);
  const byType = [...counts]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
  return { entities: entityTypes.length, byType, sources, scope: SCOPE };
};
