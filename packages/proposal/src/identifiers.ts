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
  'swift_bic',
  'ru_bic',
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
  'osm_version',
  'gem_entity_id',
  'gem_unit_id',
  'gem_project_id',
  'wikidata_id',
  'entsog_point_key',
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
    'gem_entity_id',
    'wikidata_id',
  ],
  person: ['opensanctions_id', 'date_of_birth', 'nationality', 'label_cyrillic', 'aliases'],
  legal_act: ['celex', 'ofac_action_id', 'entry_into_force'],
  state_body: [
    'registration_number',
    'registration_jurisdiction',
    'tax_id',
    'opensanctions_id',
    'label_cyrillic',
    'aliases',
    'gem_entity_id',
  ],
  bank: [
    'lei',
    'swift_bic',
    'ru_bic',
    'registration_number',
    'registration_jurisdiction',
    'tax_id',
    'opensanctions_id',
    'gem_entity_id',
  ],
  port: ['unlocode', 'osm_id', 'osm_version'],
  facility: [
    'unlocode',
    'osm_id',
    'osm_version',
    'gem_unit_id',
    'gem_project_id',
    'wikidata_id',
    'entsog_point_key',
  ],
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

// External constraint: ISO 17442. A LEI is 18 letters or digits and two check digits.
const LEI_SHAPE = /^[0-9A-Z]{18}[0-9]{2}$/u;

/** True when the text is a LEI in its legal form: the shape of ISO 17442, and the check digits of
 * ISO 7064 MOD 97-10. Each letter counts as its number from 10 to 35, and the remainder of the
 * whole number divided by 97 is 1. The text is never trimmed and never put in capitals. */
export const isValidLei = (text: string): boolean => {
  if (!LEI_SHAPE.test(text)) return false;
  let rest = 0;
  for (const character of text) {
    const value = Number.parseInt(character, 36);
    rest = (rest * (value > 9 ? 100 : 10) + value) % 97;
  }
  return rest === 1;
};

// External constraint: ISO 9362. Four letters or digits, the two letters of a country, two letters
// or digits, then a branch of three letters or digits when the code has eleven characters.
const SWIFT_BIC_SHAPE = /^[0-9A-Z]{4}[A-Z]{2}[0-9A-Z]{2}(?:[0-9A-Z]{3})?$/u;

/** The BIC in the one form that the record keeps: capitals, and eight characters for a head office.
 * `XXX` is the branch part of a head office, so ABCDRUMM and ABCDRUMMXXX are one code. It gives
 * `null` for a text that is not a BIC of ISO 9362. */
export const swiftBicOf = (text: string): string | null => {
  const bic = text.toUpperCase();
  if (!SWIFT_BIC_SHAPE.test(bic)) return null;
  return bic.endsWith('XXX') ? bic.slice(0, 8) : bic;
};

// External constraint: the directory of the Bank of Russia writes a Russian BIC as nine digits. It
// is not a code of ISO 9362, so it has a key of its own.
const RU_BIC_SHAPE = /^\d{9}$/u;

/** True when the text is a Russian BIC: exactly nine digits, and it can start with a zero. */
export const isValidRuBic = (text: string): boolean => RU_BIC_SHAPE.test(text);

/** The shapes that hold one identifier value in the attributes of a row: the value, and the value
 * as one element of a list. A text that is a number in its plain form also matches that number,
 * because a writer can store an IMO number as a number. Each shape reaches the GIN index on the
 * attributes. */
export const identifierContainment = (
  key: IdentifierKey,
  value: string,
): readonly Readonly<Record<string, { readonly v: unknown }>>[] => {
  const asNumber = Number(value);
  const bic = key === 'swift_bic' ? swiftBicOf(value) : null;
  const plain = value.trim() !== '' && String(asNumber) === value ? [value, asNumber] : [value];
  const values: unknown[] = bic === null ? plain : bic.length === 8 ? [bic, `${bic}XXX`] : [bic];
  return values.flatMap((held) => [{ [key]: { v: held } }, { [key]: { v: [held] } }]);
};
