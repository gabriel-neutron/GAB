import { z } from 'zod';

/** The fixed spellings of the identifiers that connectors and research sessions write. The
 * record takes any key of the right shape, so this list is a convention of the writers and not a
 * rule of the database. It stops `imo`, `imo_number` and `imo_no` from living side by side. */
export const IDENTIFIER_KEY = [
  'imo',
  'mmsi_history',
  'call_sign',
  'former_names',
  'flag_history',
  'imo_company_number',
  'lei',
  'registration_number',
  'registration_jurisdiction',
  'tax_id',
  'opencorporates_id',
  'opensanctions_id',
  'eu_fsf_id',
  'ofac_uid',
  'ofsi_group_id',
  'date_of_birth',
  'nationality',
  'label_cyrillic',
  'aliases',
  'celex',
  'ofac_action_id',
  'entry_into_force',
  'unlocode',
  'osm_id',
] as const;

export type IdentifierKey = (typeof IDENTIFIER_KEY)[number];

export const identifierKey = z.enum(IDENTIFIER_KEY);

/** The spellings that each entity type carries. A spelling can serve more than one type. A
 * port and a facility keep their outline in the geometry of the row, and not as an attribute. */
export const IDENTIFIER_KEYS = {
  vessel: ['imo', 'mmsi_history', 'call_sign', 'former_names', 'flag_history'],
  company: [
    'imo_company_number',
    'lei',
    'registration_number',
    'registration_jurisdiction',
    'tax_id',
    'opencorporates_id',
    'opensanctions_id',
    'eu_fsf_id',
    'ofac_uid',
    'ofsi_group_id',
  ],
  person: ['opensanctions_id', 'date_of_birth', 'nationality', 'label_cyrillic', 'aliases'],
  legal_act: ['celex', 'ofac_action_id', 'entry_into_force'],
  port: ['unlocode', 'osm_id'],
  facility: ['unlocode', 'osm_id'],
} as const satisfies Readonly<Record<string, readonly IdentifierKey[]>>;

const SEVEN_DIGITS = /^\d{7}$/;

/** True when the text is exactly seven digits and the last digit is the check digit: the six
 * digits before it, weighted seven down to two, summed, modulo ten. The text is never trimmed and
 * an `IMO` prefix is never removed, so the caller decides what it strips before it asks. */
export const isValidImo = (text: string): boolean => {
  if (!SEVEN_DIGITS.test(text)) return false;
  const digits = Array.from(text, Number);
  const sum = digits.slice(0, 6).reduce((total, digit, index) => total + digit * (7 - index), 0);
  return sum % 10 === digits[6];
};

/** The two shapes that hold one identifier value in the attributes of a row: the value itself,
 * and the value as one element of a list. Either one reaches the GIN index on the attributes.
 * The value is text, so a value that the record holds as a number does not match. */
export const identifierContainment = (
  key: IdentifierKey,
  value: string,
): {
  readonly scalar: Record<string, { readonly v: string }>;
  readonly element: Record<string, { readonly v: readonly string[] }>;
} => ({
  scalar: { [key]: { v: value } },
  element: { [key]: { v: [value] } },
});
