/** The keys that a quantity of a vessel should have, and the keys that a model wrote for the same
 * quantity (decisions.md M11 keeps the key free). The list names a key. It never refuses one, and
 * it never rewrites one. */
export const CANONICAL_KEYS: Readonly<Record<string, readonly string[]>> = {
  capacity_dwt: [
    'deadweight_t',
    'dwt_t',
    'deadweight_tonnage_t',
    'deadweight_dwt',
    'deadweight_tonnage_dwt',
    'deadweight',
    'deadweight_tonnage',
    'dwt',
  ],
  gross_tonnage_gt: ['gross_tonnage_t', 'gross_tonnage', 'gt'],
  former_names: ['former_name', 'previous_names', 'prior_names', 'formerly_known_as'],
};

/** Words for a tool description: one line for each key that has known variants. */
export const KEY_ADVICE = Object.entries(CANONICAL_KEYS)
  .map(([key, variants]) => `${key} (not ${variants.join(', ')})`)
  .join('; ');

const CANONICAL_OF = new Map(
  Object.entries(CANONICAL_KEYS).flatMap(([key, variants]) =>
    variants.map((variant) => [variant, key] as const),
  ),
);

/** A warning for each key that is a known variant of another key. A key that no list holds gets no
 * warning, and the act is accepted in both cases. */
export const keyWarnings = (keys: Iterable<string>): string[] =>
  [...new Set(keys)].flatMap((key) => {
    const canonical = CANONICAL_OF.get(key);
    return canonical === undefined
      ? []
      : [`the key ${key} is a variant of ${canonical}: write ${canonical} for the same quantity`];
  });
