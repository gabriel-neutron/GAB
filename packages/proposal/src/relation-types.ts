/** Every relation type the seed writes, and the only place one is declared. */

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
  // A listing by name. For a vessel, an entry on the vessel list of a regime: the OFAC SDN list,
  // Annex XLII of Regulation (EU) 833/2014, or a UK specified ship. For any other entity, a listing
  // with an asset freeze: the OFAC SDN list, Annex I of Regulation (EU) 269/2014, or a UK asset
  // freeze. valid_from is the entry into force, and valid_to is the delisting.
  relationType('designated_by', 'designated by', 'designates', true),
  // A sectoral measure with no asset freeze: an OFAC directive under EO 13662 or EO 14024, or an
  // annex or article of Regulation (EU) 833/2014 other than Annex XLII (the vessel list). One act
  // can hold the two kinds of measure, so the type of the relation gives the effect. The dates
  // have the same meaning as for designated_by.
  relationType('restricted_by', 'restricted by', 'restricts', true),
  // A licence and a charter each have a period.
  relationType('exempted_by', 'exempted by', 'exempts', true),
  relationType('charters', 'charters', 'is chartered by', true),
  relationType('settles_through', 'settles through', 'is the settlement channel of', false),
  relationType('supplies_crude_to', 'supplies crude to', 'receives crude from', false),
  relationType('sells_products_to', 'sells products to', 'buys products from', false),
  // A physical link between two assets, from upstream to downstream, between a facility and a
  // port. valid_from is the start of operation, and valid_to is the end. These are not a sale
  // between companies (supplies_crude_to). A gas link gets its own type when a source exists.
  relationType('crude_flows_to', 'crude flows to', 'receives crude from', true),
  relationType('products_flow_to', 'products flow to', 'receives products from', true),
  relationType('berthed_at', 'berthed at', 'is the berth of', false),
  relationType('loads_at', 'loads at', 'is the loading place of', false),
  relationType('discharges_at', 'discharges at', 'is the discharge place of', false),
  relationType('sts_with', 'sts with', 'sts with', false),
  relationType('inspected_at', 'inspected at', 'is the inspection place of', false),
  relationType('flagged_falsely', 'flagged falsely', 'is flagged falsely by', false),
  relationType('contradicts', 'contradicts', 'is contradicted by', false),
  // An event happened at an installation, a port or a vessel, and a unit or a state body carried
  // it out. An event holds its day as an attribute, so neither relation takes an interval.
  relationType('occurred_at', 'occurred at', 'is the site of', false),
  relationType('carried_out_by', 'carried out by', 'carries out', false),
  relationType('subordinate_to', 'subordinate to', 'is superior to', false),
  // A list says that two parties are linked, and it does not say how: an OFAC "Linked To" remark,
  // or the words "associated with" in a UK or EU entry.
  relationType('associated_with', 'associated with', 'is associated with', false),
  // The fallback. A word that fits no live type lands here and is kept beside the row, so a
  // missing word never fails the promotion.
  relationType('unknown', 'is linked to', 'is linked to', false),
];

const WORDS = new Map(SEEDED_RELATION_TYPES.map((one) => [one.key, one]));

/** The words of a relation type, read from its first end or from its second end. A type that the
 * list does not hold reads as its key with spaces. */
export const relationWords = (type: string, fromFarEnd: boolean): string => {
  const known = WORDS.get(type);
  if (known === undefined) return type.replaceAll('_', ' ');
  return fromFarEnd ? known.inverseLabel : known.label;
};
