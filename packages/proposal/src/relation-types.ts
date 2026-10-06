/** Every relation type the seed writes, and the only place one is declared. The seed and the
 * door that checks an interval both read it, so the two cannot hold different words. */

/** One row of `relation_type`. `inverseLabel` reads a relation from its far end. */
export interface SeededRelationType {
  readonly key: string;
  readonly label: string;
  readonly inverseLabel: string;
  /** Identity and control take `valid_from` and `valid_to`. An event takes its days as
   * attributes, and never as an interval. */
  readonly takesInterval: boolean;
}

const relationType = (
  key: string,
  label: string,
  inverseLabel: string,
  takesInterval: boolean,
): SeededRelationType => ({ key, label, inverseLabel, takesInterval });

// The label is the key in words, so a relation reads on each screen as it read before the list
// existed. Only the far end needs new words.
export const SEEDED_RELATION_TYPES: readonly SeededRelationType[] = [
  relationType('owns', 'owns', 'is owned by', true),
  relationType('operates', 'operates', 'is operated by', true),
  relationType('flags', 'flags', 'is flagged by', true),
  relationType('insures', 'insures', 'is insured by', true),
  relationType('appoints', 'appoints', 'is appointed by', true),
  // valid_from is the entry into force, and valid_to is the delisting.
  relationType('designated_by', 'designated by', 'designates', true),
  // A licence and a charter each have a period.
  relationType('exempted_by', 'exempted by', 'exempts', true),
  relationType('charters', 'charters', 'is chartered by', true),
  relationType('settles_through', 'settles through', 'is the settlement channel of', false),
  relationType('supplies_crude_to', 'supplies crude to', 'receives crude from', false),
  relationType('sells_products_to', 'sells products to', 'buys products from', false),
  relationType('berthed_at', 'berthed at', 'is the berth of', false),
  relationType('loads_at', 'loads at', 'is the loading place of', false),
  relationType('discharges_at', 'discharges at', 'is the discharge place of', false),
  relationType('sts_with', 'sts with', 'sts with', false),
  relationType('inspected_at', 'inspected at', 'is the inspection place of', false),
  relationType('flagged_falsely', 'flagged falsely', 'is flagged falsely by', false),
  relationType('contradicts', 'contradicts', 'is contradicted by', false),
  relationType('subordinate_to', 'subordinate to', 'is superior to', false),
  // The fallback. A word that fits no live type lands here and is kept beside the row, so a
  // missing word never fails the promotion.
  relationType('unknown', 'is linked to', 'is linked to', false),
];

/** The types that take an interval, in the order of the list. */
export const DATED_RELATIONS: readonly string[] = SEEDED_RELATION_TYPES.filter(
  (row) => row.takesInterval,
).map((row) => row.key);
