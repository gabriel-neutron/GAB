/** Every relation type the seed writes, and the only place one is declared. */

/** One row of `relation_type`. `inverseLabel` reads a relation from its far end. */
export interface SeededRelationType {
  readonly key: string;
  readonly label: string;
  readonly inverseLabel: string;
  /** Identity and control take `valid_from` and `valid_to`. An event takes its days as
   * attributes, and never as an interval. */
  readonly takesInterval: boolean;
  /** One sentence that says what the type means. The application and the site show it. */
  readonly definition: string;
}

const relationType = (
  key: string,
  label: string,
  inverseLabel: string,
  takesInterval: boolean,
  definition: string,
): SeededRelationType => ({ key, label, inverseLabel, takesInterval, definition });

// The label is the key in words, so a relation reads on each screen as it read before the list
// existed. Only the far end needs new words.
export const SEEDED_RELATION_TYPES: readonly SeededRelationType[] = [
  relationType(
    'owns',
    'owns',
    'is owned by',
    true,
    'A party holds shares or control of another party. The share, if known, shows on the line.',
  ),
  relationType(
    'operates',
    'operates',
    'is operated by',
    true,
    'A party runs the asset of another party day to day. The operator does not need to own it.',
  ),
  relationType(
    'flags',
    'flags',
    'is flagged by',
    true,
    'A state registers a vessel under its flag.',
  ),
  relationType(
    'insures',
    'insures',
    'is insured by',
    true,
    'A company holds the insurance cover of a vessel or a party.',
  ),
  relationType(
    'appoints',
    'appoints',
    'is appointed by',
    true,
    'A party names another party to a role, such as a manager or an agent.',
  ),
  // A listing by name. For a vessel, an entry on the vessel list of a regime: the OFAC SDN list,
  // Annex XLII of Regulation (EU) 833/2014, or a UK specified ship. For any other entity, a listing
  // with an asset freeze: the OFAC SDN list, Annex I of Regulation (EU) 269/2014, or a UK asset
  // freeze. valid_from is the entry into force, and valid_to is the delisting.
  relationType(
    'designated_by',
    'designated by',
    'designates',
    true,
    'A sanctions authority lists the party by name. A vessel is on the vessel list of a regime. Any other party is under an asset freeze.',
  ),
  // A sectoral measure with no asset freeze: an OFAC directive under EO 13662 or EO 14024, or an
  // annex or article of Regulation (EU) 833/2014 other than Annex XLII (the vessel list). One act
  // can hold the two kinds of measure, so the type of the relation gives the effect. The dates
  // have the same meaning as for designated_by.
  relationType(
    'restricted_by',
    'restricted by',
    'restricts',
    true,
    'A sanctions authority applies a measure to the party that is not an asset freeze, such as a sectoral restriction.',
  ),
  // A licence and a charter each have a period.
  relationType(
    'exempted_by',
    'exempted by',
    'exempts',
    true,
    'A licence or an exemption lets the party act despite a sanction.',
  ),
  // The issuer is stated by the title or the header of the act. The act is the source end, so the
  // far end is the body. An act keeps the one type, and a designation of a party stays designated_by.
  relationType(
    'issued_by',
    'issued by',
    'issues',
    false,
    'A legal act states in its title or header the body that issued it. Source: a legal act. Far end: a state body.',
  ),
  relationType(
    'charters',
    'charters',
    'is chartered by',
    true,
    'A party hires a vessel from another party for a period.',
  ),
  // These five types take dates. A date comes only from the date of the activity that the
  // source gives, never from the date of a designation. An end that the source does not give
  // stays empty. One fact gets one type only.
  relationType(
    'settles_through',
    'settles through',
    'is the settlement channel of',
    true,
    'A party sends or receives its payments through a bank, a payment system, or the operator of a system such as SPFS or CIPS. The far end is a channel. When the far end is a principal that the party pays for, use pays_for. An EU ban on transactions with a bank is restricted_by. Source: any party. Far end: a bank, a company or a state body that runs a payment system.',
  ),
  relationType(
    'acts_for',
    'acts for',
    'has as agent',
    true,
    'A source states that the party does business for the far end as its agent, front or proxy. The designation basis alone ("owned or controlled by, or acted for or on behalf of") is not enough. When the party only moves money for the far end, use pays_for. Source: a company, a bank or a person. Far end: a company, a bank, a state body or a person.',
  ),
  relationType(
    'supplies_items_to',
    'supplies items to',
    'receives items from',
    true,
    'A source states that the party sold, shipped or delivered goods (components, dual-use goods, equipment or arms) to the far end. The class of the goods is an attribute of the relation. Crude oil and refined products keep their own types. "Materially assisted", "customers include", "attempted to supply", "involved in procurement" and "transshipment" are not enough. Source: a company or a facility. Far end: a company, a facility, a state body or a military unit.',
  ),
  relationType(
    'transfers_funds_to',
    'transfers funds to',
    'receives funds from',
    true,
    'A source states that the party sent money to the far end, the payee. The amount is an attribute when the source gives it. When the party pays for a named principal, use pays_for. Source: any party. Far end: any party.',
  ),
  relationType(
    'pays_for',
    'makes payments for',
    'has payments made by',
    true,
    'A source states that a bank or a payment agent made or facilitated payments on behalf of the far end, the principal. The designation basis alone ("conducted or facilitated any significant transaction") is not enough. A plan or a scheme ("would facilitate") gets the attribute status: planned. Source: a bank or a company. Far end: any party.',
  ),
  relationType(
    'supplies_crude_to',
    'supplies crude to',
    'receives crude from',
    false,
    'A company sells crude oil to another company. This is a sale and not a physical link.',
  ),
  relationType(
    'sells_products_to',
    'sells products to',
    'buys products from',
    false,
    'A company sells refined products to another company. This is a sale and not a physical link.',
  ),
  // A physical link between two assets, from upstream to downstream, between a facility and a
  // port. valid_from is the start of operation, and valid_to is the end. These are not a sale
  // between companies (supplies_crude_to). gas_flows_to carries natural gas or LNG: a field to a
  // processing plant or an LNG plant, a plant to its terminal, a pipeline to the border.
  relationType(
    'crude_flows_to',
    'crude flows to',
    'is fed crude by',
    true,
    'Crude oil moves through a physical link, such as a pipeline, from an upstream asset to a downstream asset.',
  ),
  relationType(
    'products_flow_to',
    'products flow to',
    'receives products from',
    true,
    'Refined products move through a physical link, such as a pipeline, from an upstream asset to a downstream asset.',
  ),
  relationType(
    'gas_flows_to',
    'gas flows to',
    'is fed gas by',
    true,
    'Natural gas or LNG moves through a physical link from an upstream asset to a downstream asset.',
  ),
  relationType(
    'berthed_at',
    'berthed at',
    'is the berth of',
    false,
    'A vessel stood at a berth of a port or a terminal.',
  ),
  relationType(
    'loads_at',
    'loads at',
    'is the loading place of',
    false,
    'A vessel takes cargo at a place.',
  ),
  relationType(
    'discharges_at',
    'discharges at',
    'is the discharge place of',
    false,
    'A vessel unloads cargo at a place.',
  ),
  relationType(
    'sts_with',
    'sts with',
    'sts with',
    false,
    'Two vessels transfer cargo at sea, from one ship to the other. The relation is the same from each end.',
  ),
  relationType(
    'inspected_at',
    'inspected at',
    'is the inspection place of',
    false,
    'An authority inspected a vessel at a place.',
  ),
  relationType(
    'flagged_falsely',
    'flagged falsely',
    'is flagged falsely by',
    false,
    'A vessel showed a flag that it had no right to show.',
  ),
  relationType(
    'contradicts',
    'contradicts',
    'is contradicted by',
    false,
    'One source or fact does not agree with another. The record keeps both.',
  ),
  // An event happened at an installation, a port or a vessel, and a unit or a state body carried
  // it out. An event holds its day as an attribute, so neither relation takes an interval.
  relationType(
    'occurred_at',
    'occurred at',
    'is the site of',
    false,
    'An event took place at an installation, a port or a vessel.',
  ),
  relationType(
    'carried_out_by',
    'carried out by',
    'carries out',
    false,
    'A unit or a state body carried out an event.',
  ),
  relationType(
    'subordinate_to',
    'subordinate to',
    'is superior to',
    false,
    'A unit is under the command of a higher unit. This is a chain of command and not ownership.',
  ),
  // A list says that two parties are linked, and it does not say how: an OFAC "Linked To" remark,
  // or the words "associated with" in a UK or EU entry.
  relationType(
    'associated_with',
    'associated with',
    'is associated with',
    false,
    'A list says that two parties are linked and does not say how.',
  ),
  // The fallback. A word that fits no live type lands here and is kept beside the row, so a
  // missing word never fails the promotion.
  relationType(
    'unknown',
    'is linked to',
    'is linked to',
    false,
    'The record holds a link between two parties, and no listed type fits it.',
  ),
];

/** The relation type of a physical link for each product. A relation has no attributes, so its
 * type gives the product. The release and the map both read this map. */
export const PRODUCT_LINK_TYPES = {
  crude: 'crude_flows_to',
  products: 'products_flow_to',
  gas: 'gas_flows_to',
} as const;

export type ProductKey = keyof typeof PRODUCT_LINK_TYPES;

const WORDS = new Map(SEEDED_RELATION_TYPES.map((one) => [one.key, one]));

/** The words of a relation type, read from its first end or from its second end. A type that the
 * list does not hold reads as its key with spaces. */
export const relationWords = (type: string, fromFarEnd: boolean): string => {
  const known = WORDS.get(type);
  if (known === undefined) return type.replaceAll('_', ' ');
  return fromFarEnd ? known.inverseLabel : known.label;
};

/** The definition of a relation type, or `null` for a type that the list does not hold. */
export const relationDefinition = (type: string): string | null =>
  WORDS.get(type)?.definition ?? null;
