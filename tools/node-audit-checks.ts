// The checks of the node audit (`pnpm node:audit`, run book in infra/vps/README.md). Each check is a pure
// function over the facts of one node. No check writes to the record.
//
// Method (panel verdict of 2026-11-26: osint-expert, software-architect, skeptic, two rounds):
// - The unit is a node of tools/critical-nodes-replay.ts, with each claim about one of its members.
// - Each check gives pass, fail, cannot_check or not_applicable, always with a reason. No check skips.
// - A claim passes value_in_excerpt and designation_source when one of its citations passes.
// - The NATO letter rates the author (docs/decisions.md S1). It never fails a node: a designation with
//   letter C or F is flagged in the summary.
// - Release mode reads only the public release, so a release pass is "release_pass", and the four
//   checks of the stored document are cannot_check(needs_record). Record mode reads the database and
//   the raw store of the PC, read only.
// - Release mode also reads each cited document at its public address (excerpt_at_source). A document
//   that it cannot read goes to local-check.txt, and record mode on the PC checks its stored copy.

import { createHash } from 'node:crypto';

import { day as calendarDay } from '@gab/proposal/day';
import { isValidImo, isValidLei, isValidRuBic } from '@gab/proposal/identifiers';
import { refusedSource } from '@gab/tools/refused-source';
import {
  duplicateIdentifiers,
  plainIdentifier,
  UNIQUE_KEYS,
} from '@gab/tools/duplicate-identifier';
import { cutsToken, findExcerpt, fold } from '@gab/tools/excerpt';

import {
  countryNames,
  valuesOf,
  type claimedDays,
  type ReleaseFiles,
} from './critical-nodes-replay.ts';

type Row = Readonly<Record<string, string>>;

export type Verdict = 'pass' | 'fail' | 'cannot_check' | 'not_applicable';

export interface Result {
  readonly check: string;
  readonly verdict: Verdict;
  readonly reason: string;
}

/** One claim of the release with each of its citation rows. */
export interface Claim {
  readonly id: string;
  readonly kind: 'attribute' | 'relation';
  readonly subject: string;
  readonly attribute: string;
  readonly value: string;
  readonly relationType: string;
  readonly object: string;
  readonly objectLabel: string;
  readonly citations: readonly Row[];
}

/** The checks of a fact, in this order in each line of the result file. */
export const FACT_CHECKS = [
  'excerpt_present',
  'value_in_excerpt',
  'deny_list',
  'identifier_valid',
  'dates',
  'designation_source',
  'excerpt_at_source',
  'document_exists',
  'hash',
  'excerpt_at_page',
  'document_level',
] as const;

/** The checks of a node as a whole. */
export const NODE_CHECKS = ['has_facts', 'no_duplicate', 'person_rule'] as const;

const result = (check: string, verdict: Verdict, reason: string): Result => ({
  check,
  verdict,
  reason,
});

/** The claims of the release, grouped by claim id. */
export const claimsOf = (rows: readonly Row[]): Map<string, Claim> => {
  const claims = new Map<string, Claim & { citations: Row[] }>();
  for (const row of rows) {
    const id = row['claim_id'] ?? '';
    const held = claims.get(id);
    if (held !== undefined) {
      held.citations.push(row);
      continue;
    }
    claims.set(id, {
      id,
      kind: row['claim_kind'] === 'relation' ? 'relation' : 'attribute',
      subject: row['subject_id'] ?? '',
      attribute: row['attribute'] ?? '',
      value: row['value'] ?? '',
      relationType: row['relation_type'] ?? '',
      object: row['object_id'] ?? '',
      objectLabel: row['object_label'] ?? '',
      citations: [row],
    });
  }
  return claims;
};

/** The values of the unique keys of each entity, from its attribute claims, in their plain form. */
export const identifiersOf = (claims: Iterable<Claim>): Map<string, Map<string, string[]>> => {
  const found = new Map<string, Map<string, string[]>>();
  const keys = new Set<string>(UNIQUE_KEYS);
  for (const claim of claims) {
    if (claim.kind !== 'attribute' || !keys.has(claim.attribute)) continue;
    const own = found.get(claim.subject) ?? new Map<string, string[]>();
    const list = own.get(claim.attribute) ?? [];
    for (const one of valuesOf(claim.value)) {
      const plain = plainIdentifier(claim.attribute, one);
      if (plain !== '' && !list.includes(plain)) list.push(plain);
    }
    own.set(claim.attribute, list);
    found.set(claim.subject, own);
  }
  return found;
};

const excerptOf = (row: Row) => row['excerpt'] ?? '';

/** True when the text holds the identifier as a whole token: a digit identifier with no digit on
 * either side ("IMO9435337" holds 9435337), any other with no letter or digit on either side. The
 * text is not joined, so "943 5337" is two numbers and holds no 9435337. */
export const holdsIdentifier = (text: string, identifier: string): boolean => {
  if (identifier === '') return false;
  const edge = /^\d+$/u.test(identifier) ? String.raw`\d` : String.raw`[\p{L}\p{N}]`;
  const body = identifier.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return new RegExp(`(?<!${edge})${body}(?!${edge})`, 'u').test(text.toUpperCase());
};

// A legal form, which a register writes before or after the name: "PJSC VTB Bank" is "VTB BANK
// PUBLIC JOINT STOCK COMPANY".
const LEGAL_FORM = new RegExp(
  String.raw`(?<![\p{L}\p{N}])(?:` +
    [
      'public joint[- ]stock company',
      'open joint[- ]stock company',
      'closed joint[- ]stock company',
      'joint[- ]stock company',
      'limited liability company',
      'публичное акционерное общество',
      'акционерное общество',
      'общество с ограниченной ответственностью',
      'pjsc|ojsc|cjsc|jsc|pao|oao|zao|ao|ooo|llc|ltd|limited|inc|corp',
      'пао|оао|зао|ао|ооо',
    ].join('|') +
    String.raw`)(?![\p{L}\p{N}])`,
  'gu',
);

/** A name or a text in one form for a name match: folded, lower case, no legal form, no quotes
 * and no brackets. */
const plainName = (text: string): string =>
  fold(text)
    .text.toLowerCase()
    .replace(/[«»"'.,()]/gu, ' ')
    .replace(LEGAL_FORM, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

/** True when the text holds the name as whole words, with no regard to case or legal form. */
export const holdsName = (text: string, name: string): boolean => {
  const core = plainName(name);
  if (core === '') return false;
  const body = core.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, 'u').test(plainName(text));
};

const MONTHS: Readonly<Record<string, number>> = Object.fromEntries(
  [
    ['january', 'jan', 'января', 'январь'],
    ['february', 'feb', 'февраля', 'февраль'],
    ['march', 'mar', 'марта', 'март'],
    ['april', 'apr', 'апреля', 'апрель'],
    ['may', 'мая', 'май'],
    ['june', 'jun', 'июня', 'июнь'],
    ['july', 'jul', 'июля', 'июль'],
    ['august', 'aug', 'августа', 'август'],
    ['september', 'sep', 'sept', 'сентября', 'сентябрь'],
    ['october', 'oct', 'октября', 'октябрь'],
    ['november', 'nov', 'ноября', 'ноябрь'],
    ['december', 'dec', 'декабря', 'декабрь'],
  ].flatMap((names, at) => names.map((name) => [name, at + 1])),
);
const MONTH = String.raw`(\p{L}+)\.?`;
const iso = (year: string, month: number, day: number): string =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** 'yes' when the text writes the day in a word form ("24 February 2022", "December 18, 2026") or
 * a number form whose order is clear ("02/24/2022", "13.8.2026"). 'ambiguous' when only a number
 * form with day and month both up to 12 can be the day: the order is a guess. */
export const holdsDay = (text: string, day: string): 'yes' | 'ambiguous' | 'no' => {
  const lower = text.toLowerCase();
  const [year = ''] = day.split('-');
  const want = (m: number | undefined, d: string) =>
    m !== undefined && iso(year, m, Number(d)) === day;
  for (const found of lower.matchAll(
    new RegExp(String.raw`(?<!\d)(\d{1,2})\.?\s+${MONTH}\s*,?\s+(\d{4})(?!\d)`, 'gu'),
  ))
    if (found[3] === year && want(MONTHS[found[2] ?? ''], found[1] ?? '')) return 'yes';
  for (const found of lower.matchAll(
    new RegExp(String.raw`${MONTH}\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s+(\d{4})(?!\d)`, 'gu'),
  ))
    if (found[3] === year && want(MONTHS[found[1] ?? ''], found[2] ?? '')) return 'yes';
  let ambiguous = false;
  for (const found of lower.matchAll(/(?<![\d./])(\d{1,2})([./])(\d{1,2})\2(\d{4})(?!\d)/gu)) {
    if (found[4] !== year) continue;
    const first = Number(found[1]);
    const second = Number(found[3]);
    const dayFirst = second <= 12 && want(second, String(first));
    const monthFirst = first <= 12 && want(first, String(second));
    if (!dayFirst && !monthFirst) continue;
    if (first > 12 || second > 12 || first === second) return 'yes';
    ambiguous = true;
  }
  return ambiguous ? 'ambiguous' : 'no';
};
const SCALES: readonly (readonly [RegExp, number])[] = [
  [/^(?:трлн|trillion|tn)$/u, 1e12],
  [/^(?:млрд|billion|bn|bln)$/u, 1e9],
  [/^(?:млн|million|mn|mln)$/u, 1e6],
  [/^(?:тыс|thousand)$/u, 1e3],
];
const scaleOf = (word: string): number | undefined =>
  SCALES.find(([pattern]) => pattern.test(word))?.[1];
const near = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

interface Reading {
  readonly value: number;
  /** False when the text can also give another reading of the same number. */
  readonly certain: boolean;
}

/** The readings of each number of a text, with the scale word after it: "109,2 млн" is 109.2e6,
 * "5 108 691" and "5,108,691" are 5108691. One group of three digits after a comma or a point is
 * thousands or a decimal part: "900,000 bpd" is certain 900000 and uncertain 900, and "1,100 млн"
 * is uncertain in each reading, because a scale word often follows a decimal comma. */
const numbersOf = (text: string): { readings: Reading[]; scale: number | undefined }[] => {
  const out: { readings: Reading[]; scale: number | undefined }[] = [];
  const pattern =
    /(?<![\p{L}\p{N}.,])(?:(\d{1,3}(?:([ \u00A0\u202F,.'])\d{3})(?:\2\d{3})*)([.,]\d+)?|(\d+)(?:[.,](\d+))?)(?!\p{N})(?:\s*(\p{L}+))?/gu;
  for (const found of text.toLowerCase().matchAll(pattern)) {
    const scale = scaleOf(found[6] ?? '');
    const grouped = found[1];
    if (grouped === undefined) {
      out.push({
        readings: [{ value: Number(`${found[4] ?? ''}.${found[5] ?? '0'}`), certain: true }],
        scale,
      });
      continue;
    }
    const separator = found[2] ?? '';
    const whole = grouped.split(separator).join('');
    const tail = (found[3] ?? '').slice(1);
    const thousands = Number(`${whole}.${tail === '' ? '0' : tail}`);
    const twoWays =
      (separator === ',' || separator === '.') && grouped.split(separator).length === 2 && !tail;
    out.push({
      readings: twoWays
        ? [
            { value: thousands, certain: scale === undefined },
            { value: Number(grouped.replace(separator, '.')), certain: false },
          ]
        : [{ value: thousands, certain: true }],
      scale,
    });
  }
  return out;
};

/** The scale of an attribute from its name: "total_assets_bn_byn" is in billions, and "mt" is
 * million tonnes (in a text, "mt" is a metric tonne). */
const attributeScale = (attribute: string): number =>
  attribute
    .split('_')
    .map((part) => (part === 'mt' ? 1e6 : scaleOf(part)))
    .find((one) => one !== undefined) ?? 1;

/** 'yes' when the text writes the number at the scale that the text states, or as the claim writes
 * it when the text states no scale. 'ambiguous' when only an uncertain reading gives the value.
 * 'scale' when only a power of 1000 that the text does not state joins the two. */
export const holdsNumber = (
  text: string,
  value: number,
  attribute: string,
): 'yes' | 'ambiguous' | 'scale' | 'no' => {
  const target = value * attributeScale(attribute);
  let open: 'ambiguous' | 'scale' | 'no' = 'no';
  for (const { readings, scale: stated } of numbersOf(text))
    for (const one of readings) {
      if (stated !== undefined ? near(one.value * stated, target) : near(one.value, value)) {
        if (one.certain) return 'yes';
        open = 'ambiguous';
      }
      if (
        open === 'no' &&
        stated === undefined &&
        [1e3, 1e6, 1e9, 1e12].some((k) => near(one.value * k, target))
      )
        open = 'scale';
    }
  return open;
};

// An identifier is never read as a number: "273 278 850" is not the MMSI 273278850.
const NOT_A_NUMBER = /(?:^|_)(?:imo|mmsi|lei|bic|id|year|number|code)(?:_|$)/u;
const NUMBER = /^-?\d+(?:\.\d+)?$/u;

/** How an excerpt holds one value of an attribute: as written, or in a written form of a day, a
 * number or a country code. */
const holdsValue = (
  text: string,
  value: string,
  attribute: string,
): 'yes' | 'ambiguous_date' | 'ambiguous_number' | 'scale_not_stated' | 'no' => {
  const asNumber = NUMBER.test(value) && !NOT_A_NUMBER.test(attribute) && !UNIQUE.has(attribute);
  const span = findExcerpt(text, value);
  // A number is a whole token: 900 is not in "900,000".
  if (span !== null && !(asNumber && cutsToken(text, span))) return 'yes';
  if (/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    const found = holdsDay(text, value);
    return found === 'ambiguous' ? 'ambiguous_date' : found;
  }
  // A country code holds only on a field that is the country name, alone or after its label:
  // "Atlanta, Georgia" or "owned by a Russian businessman" states no country of the entity.
  if (/^[A-Z]{2}$/u.test(value)) {
    const fields = text.split(/[,;|\t\n]+/u).map((one) =>
      one
        .replace(/^["'\s]+|["'\s.]+$/gu, '')
        .replace(/^(?:country|flag|nationality|jurisdiction|place of registration)\s*:\s*/iu, '')
        .toLowerCase(),
    );
    // "Russian Federation" is the full name of Russia; an adjective alone is no country.
    const names = countryNames(value).flatMap((name) => [name, `${name} federation`]);
    return names.some((name) => fields.includes(name.toLowerCase()) && name !== 'russian')
      ? 'yes'
      : 'no';
  }
  if (asNumber) {
    const found = holdsNumber(text, Number(value), attribute);
    return found === 'scale'
      ? 'scale_not_stated'
      : found === 'ambiguous'
        ? 'ambiguous_number'
        : found;
  }
  return 'no';
};
const UNIQUE = new Set<string>(UNIQUE_KEYS);

/** The names of each far end of a relation that the release holds (label, aliases, former names,
 * other scripts), and for a legal act the documents that give it. */
export interface FarEnd {
  readonly names: readonly string[];
  readonly documents: readonly string[];
}

const NAME_ATTRIBUTES = new Set(['aliases', 'former_names', 'name_cyrillic', 'name_other']);

export const farEndsOf = (
  entities: readonly Row[],
  claims: Iterable<Claim>,
): Map<string, FarEnd> => {
  const ends = new Map<string, { names: string[]; documents: string[] }>();
  for (const one of entities)
    ends.set(one['id'] ?? '', {
      names: [one['label'] ?? ''].filter((name) => name !== ''),
      documents:
        one['type'] === 'legal_act'
          ? (one['document_ids'] ?? '').split(/[\s;,]+/u).filter((id) => id !== '')
          : [],
    });
  for (const claim of claims) {
    if (claim.kind !== 'attribute' || !NAME_ATTRIBUTES.has(claim.attribute)) continue;
    const own = ends.get(claim.subject);
    if (own === undefined) continue;
    try {
      own.names.push(...valuesOf(claim.value).filter((name) => name !== ''));
    } catch {
      // A list that does not parse gives no name; value_in_excerpt of that claim fails it.
    }
  }
  return ends;
};

const ACT_LINKS = new Set(['designated_by', 'restricted_by', 'exempted_by']);

export const excerptPresent = (claim: Claim): Result =>
  claim.citations.some((row) => excerptOf(row).trim() !== '')
    ? result('excerpt_present', 'pass', 'an excerpt is given')
    : result('excerpt_present', 'fail', 'no_excerpt');

/** An attribute: one excerpt holds each value (folded match, or a written form of a day, a number
 * or a country code). A relation: one excerpt names the far end, by a name that the release holds
 * for it or one of its identifiers, or cites the act that is the far end. A designation goes to
 * designation_source. */
export const valueInExcerpt = (
  claim: Claim,
  identifiers: ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>,
  farEnds: ReadonlyMap<string, FarEnd> = new Map(),
): Result => {
  const check = 'value_in_excerpt';
  if (claim.kind === 'relation') {
    if (claim.relationType === 'designated_by')
      return result(check, 'not_applicable', 'checked by designation_source');
    const far = [...(identifiers.get(claim.object)?.values() ?? [])].flat();
    const end = farEnds.get(claim.object);
    const names = [claim.objectLabel, ...(end?.names ?? [])].filter((name) => name !== '');
    const named = claim.citations.some(
      (row) =>
        (claim.objectLabel !== '' && findExcerpt(excerptOf(row), claim.objectLabel) !== null) ||
        names.some((name) => holdsName(excerptOf(row), name)) ||
        far.some((one) => holdsIdentifier(excerptOf(row), one)),
    );
    if (named) return result(check, 'pass', 'an excerpt names the far end');
    // The official text of an act names the act by its own text, not by the label of the release.
    const act = claim.citations.find(
      (row) =>
        ACT_LINKS.has(claim.relationType) &&
        OFFICIAL_TYPES.has(row['document_type'] ?? '') &&
        (end?.documents ?? []).includes(row['document_id'] ?? ''),
    );
    return act !== undefined
      ? result(check, 'pass', `the cited document ${act['document_id'] ?? ''} is the act`)
      : result(check, 'cannot_check', 'far_end_not_named');
  }
  let values: string[];
  try {
    values = valuesOf(claim.value);
  } catch {
    return result(check, 'fail', 'value_not_parsed');
  }
  if (values.length === 0) return result(check, 'not_applicable', 'no_value');
  // A citation holds the claim when each value is in its excerpt. A value that only a guess of the
  // order of a day, or of an unstated scale, joins to the excerpt leaves the claim open.
  let open = '';
  for (const row of claim.citations) {
    const found = values.map((one) => holdsValue(excerptOf(row), one, claim.attribute));
    if (found.every((one) => one === 'yes'))
      return result(check, 'pass', 'an excerpt holds the value');
    if (open === '' && !found.includes('no')) open = found.find((one) => one !== 'yes') ?? '';
  }
  if (open !== '') return result(check, 'cannot_check', open);
  // A value of a closed list ("export_terminal") is a class that a reader gives, never a quote.
  return values.every((one) => CODED.test(one))
    ? result(check, 'cannot_check', 'coded_value')
    : result(check, 'fail', 'value_not_in_excerpt');
};

const CODED = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/u;

export const denyList = (claim: Claim): Result => {
  for (const row of claim.citations) {
    const refused = refusedSource(row['document_address'] ?? '');
    if (refused !== null) return result('deny_list', 'fail', refused);
  }
  return result('deny_list', 'pass', 'no cited address is refused');
};

const VALIDATORS: Readonly<Record<string, (text: string) => boolean>> = {
  imo: isValidImo,
  lei: isValidLei,
  ru_bic: isValidRuBic,
};

// shortcut: no check digit for tax_id and registration_number, because the release gives no country
// of the number; add one when the country of each number is known.
export const identifierValid = (claim: Claim): Result => {
  const check = 'identifier_valid';
  const valid = VALIDATORS[claim.attribute];
  if (claim.kind !== 'attribute' || valid === undefined)
    return result(check, 'not_applicable', 'no check digit for this attribute');
  let values: string[];
  try {
    values = valuesOf(claim.value);
  } catch {
    return result(check, 'fail', 'value_not_parsed');
  }
  if (values.length === 0) return result(check, 'not_applicable', 'no_value');
  const bad = values.filter((one) => !valid(plainIdentifier(claim.attribute, one)));
  return bad.length === 0
    ? result(check, 'pass', `${claim.attribute} is well formed`)
    : result(check, 'fail', `bad ${claim.attribute}: ${bad.join(' ')}`);
};

const DAY = /^\d{4}(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/u;

/** A year, a month or a day that exists in the calendar. */
const isDay = (text: string): boolean => {
  if (!DAY.test(text)) return false;
  if (text.length < 10) return true;
  const day = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(text);
};
const ACT_DATES = ['entry_into_force', 'adopted_on', 'ofac_action_id'];

/** The bounds of a relation are in ISO form and in order. A bound that the relation row does not
 * hold can be a day that the release gives as a claim of the relation, as the replay reads it. A
 * designation with no bound takes the date of its act, so its act must have one. */
export const dates = (
  claim: Claim,
  actAttributes: ReadonlyMap<string, ReadonlySet<string>>,
  days: ReturnType<typeof claimedDays> = new Map(),
): Result => {
  const check = 'dates';
  // A bound that the release gives as a claim of the relation must be a day: the site and the
  // replay read no other value.
  const head = claim.citations[0] ?? {};
  if (
    claim.kind === 'attribute' &&
    head['subject_kind'] === 'relation' &&
    (claim.attribute === 'valid_from' || claim.attribute === 'valid_to')
  )
    return calendarDay.safeParse(claim.value).success
      ? result(check, 'pass', 'the claimed bound is a day')
      : result(check, 'fail', `claimed_bound_not_a_day: ${claim.value}`);
  if (claim.kind !== 'relation') return result(check, 'not_applicable', 'not a relation');
  // The bounds belong to the relation, so each citation row of the claim holds the same bounds.
  const row = claim.citations[0] ?? {};
  const from = (row['valid_from'] ?? '') || (days.get(`${claim.id}/valid_from`)?.day ?? '');
  const to = (row['valid_to'] ?? '') || (days.get(`${claim.id}/valid_to`)?.day ?? '');
  for (const one of [from, to])
    if (one !== '' && !isDay(one)) return result(check, 'fail', `bad_date: ${one}`);
  if (from !== '' && to !== '' && from > to)
    return result(check, 'fail', `start ${from} after end ${to}`);
  if (from === '' && to === '') {
    if (claim.relationType !== 'designated_by')
      return result(check, 'not_applicable', 'no_date_stated');
    const own = actAttributes.get(claim.object);
    return ACT_DATES.some((name) => own?.has(name) === true)
      ? result(check, 'pass', 'the act has a date')
      : result(check, 'fail', 'no_act_date');
  }
  return result(check, 'pass', 'the bounds are in order');
};

const OFFICIAL_TYPES = new Set(['register_entry', 'legal_act', 'official_publication']);

/** A designation rests on an official document whose excerpt holds an identifier of the subject
 * itself, as a whole token. A match on the name alone is no proof. */
export const designationSource = (
  claim: Claim,
  identifiers: ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>,
): Result => {
  const check = 'designation_source';
  if (claim.relationType !== 'designated_by')
    return result(check, 'not_applicable', 'not a designation');
  const official = claim.citations.filter((row) => OFFICIAL_TYPES.has(row['document_type'] ?? ''));
  if (official.length === 0) return result(check, 'fail', 'no_official_document');
  const own = [...(identifiers.get(claim.subject)?.entries() ?? [])];
  if (own.length === 0) return result(check, 'cannot_check', 'no_identifier');
  for (const row of official)
    for (const [key, values] of own)
      for (const one of values)
        if (holdsIdentifier(excerptOf(row), one))
          return result(check, 'pass', `${key} ${one} in ${row['document_id'] ?? ''}`);
  return result(check, 'cannot_check', 'name_only');
};

/** What a live read of one cited document gave: its text, or the cause that stopped the check. */
export type SourceRead =
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'cannot_check';
      readonly reason: 'blocked' | 'unreachable' | 'not_text' | 'no_address';
    };

/** Reads one cited document at its public address, once for each document id. */
export type SourceReader = (id: string, address: string) => Promise<SourceRead>;

/** One citation passes when its excerpt is in the live text of its document. A claim fails only when
 * each document with an excerpt was read and holds none: a document that could not be read can hold
 * one. Record mode checks the stored copy (excerpt_at_page), so this check does not run there. */
export const excerptAtSource = async (
  claim: Claim,
  mode: 'release' | 'record',
  read: SourceReader | null,
): Promise<Result> => {
  const check = 'excerpt_at_source';
  if (mode === 'record') return result(check, 'not_applicable', 'checked by excerpt_at_page');
  if (read === null) return result(check, 'cannot_check', 'needs_source');
  const cited = claim.citations.filter((row) => excerptOf(row).trim() !== '');
  if (cited.length === 0) return result(check, 'not_applicable', 'no_excerpt');
  const open = new Map<string, string>();
  for (const row of cited) {
    const id = row['document_id'] ?? '';
    const got = await read(id, row['document_address'] ?? '');
    if (got.kind === 'cannot_check') open.set(id, got.reason);
    else if (findExcerpt(got.text, excerptOf(row)) !== null)
      return result(check, 'pass', `the excerpt is in ${id} at its address`);
  }
  if (open.size === 0) return result(check, 'fail', 'excerpt_not_at_source');
  const [reason] = [...new Set(open.values())].sort();
  return result(check, 'cannot_check', `${reason ?? ''}: ${[...open.keys()].join(' ')}`);
};

/** What record mode reads for one document: its row, the hash of its stored bytes, and a page.
 * Through the tunnel to the VPS, storedSha256 is null (no store), and a document that is not an
 * export document is 'hidden': it exists, and the role may not read it. */
export interface RecordReader {
  document(
    id: string,
  ): Promise<{ sha256: string; level: string; storedSha256: string | null } | 'hidden' | null>;
  page(id: string, page: number): Promise<string | null>;
}

export const sha256Of = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex');

const RATED = new Set(['A', 'B', 'C']);

// A CSV field of a register can stand in quotes ("LIBERTY"), and the stored text of the file can
// give it with no quotes (LIBERTY). This normal form is only for the excerpt_at_page match.
const CSV_FIELD = /(?:^|,)"|"(?:,|$)/u;
const noQuotes = (text: string): string => text.replaceAll('"', '');
const atPageOf = (page: string, excerpt: string): boolean =>
  findExcerpt(page, excerpt) !== null ||
  (CSV_FIELD.test(excerpt) && findExcerpt(noQuotes(page), noQuotes(excerpt)) !== null);

/** The four checks of the stored documents. With no reader (release mode) each one is
 * cannot_check(needs_record). */
export const recordChecks = async (
  claim: Claim,
  reader: RecordReader | null,
): Promise<Result[]> => {
  const names = ['document_exists', 'hash', 'excerpt_at_page', 'document_level'] as const;
  if (reader === null) return names.map((name) => result(name, 'cannot_check', 'needs_record'));
  const ids = [...new Set(claim.citations.map((row) => row['document_id'] ?? ''))];
  const found = await Promise.all(ids.map(async (id) => [id, await reader.document(id)] as const));
  const missing = found.filter(([, one]) => one === null).map(([id]) => id);
  const hidden = found.filter(([, one]) => one === 'hidden').map(([id]) => id);
  const read = found.flatMap(([id, one]) =>
    one === null || one === 'hidden' ? [] : [[id, one] as const],
  );
  // A document with no hash or no stored bytes fails: two empty values are no match.
  const broken = read
    .filter(
      ([, one]) =>
        one.sha256 === '' ||
        (one.storedSha256 !== null && (one.storedSha256 === '' || one.sha256 !== one.storedSha256)),
    )
    .map(([id]) => id);
  const unread = read.some(([, one]) => one.storedSha256 === null);
  // A check that would fail can pass on a hidden document, so it cannot run.
  const failOrHidden = (name: (typeof names)[number], reason: string): Result =>
    hidden.length > 0
      ? result(name, 'cannot_check', `not_export_document: ${hidden.join(' ')}`)
      : result(name, 'fail', reason);
  let atPage = false;
  for (const row of claim.citations) {
    const text = await reader.page(row['document_id'] ?? '', Number(row['page'] ?? '0'));
    if (text !== null && excerptOf(row) !== '' && atPageOf(text, excerptOf(row))) {
      atPage = true;
      break;
    }
  }
  // The level is a mark, not a filter (ADR 0039): a document that the signed list does not rate
  // passes as 'unrated'. Only a level that the record does not give is a fault.
  const rated = read.some(([, one]) => RATED.has(one.level));
  // A level that the record does not give is a fault, also beside a rated or unrated document.
  const unknown = read.some(([, one]) => !RATED.has(one.level) && one.level !== 'not_verified');
  const unrated = !unknown && read.length > 0;
  return [
    missing.length === 0
      ? result('document_exists', 'pass', 'each cited document is in the record')
      : result('document_exists', 'fail', `absent: ${missing.join(' ')}`),
    broken.length > 0
      ? result('hash', 'fail', `hash differs: ${broken.join(' ')}`)
      : read.length === 0
        ? result('hash', 'cannot_check', hidden.length > 0 ? 'not_export_document' : 'no document')
        : unread
          ? result('hash', 'cannot_check', 'needs_store')
          : hidden.length > 0
            ? result('hash', 'cannot_check', `not_export_document: ${hidden.join(' ')}`)
            : result('hash', 'pass', 'the stored bytes match the hash'),
    atPage
      ? result('excerpt_at_page', 'pass', 'an excerpt is in the stored text at its page')
      : failOrHidden('excerpt_at_page', 'excerpt_not_at_page'),
    rated && !unknown
      ? result('document_level', 'pass', 'a cited document has a level')
      : unrated
        ? result('document_level', 'pass', 'unrated')
        : failOrHidden('document_level', 'no_level_in_record'),
  ];
};

/** The node checks: the node has claims, no member shares a unique identifier with another entity, and a natural person
 * rests on a designation (research/signed-list.md, "All lines"). */
export const nodeChecks = (
  members: readonly string[],
  factCount: number,
  duplicates: ReadonlyMap<string, string>,
  type: ReadonlyMap<string, string>,
  designated: ReadonlySet<string>,
): Result[] => {
  const twice = members.flatMap((one) => {
    const reason = duplicates.get(one);
    return reason === undefined ? [] : [reason];
  });
  const persons = members.filter((one) => type.get(one) === 'person');
  const bare = persons.filter((one) => !designated.has(one));
  return [
    factCount === 0
      ? result('has_facts', 'cannot_check', 'no_claim')
      : result('has_facts', 'pass', `${String(factCount)} claims`),
    twice.length === 0
      ? result('no_duplicate', 'pass', 'no shared identifier')
      : result('no_duplicate', 'fail', twice.join('; ')),
    persons.length === 0
      ? result('person_rule', 'not_applicable', 'no natural person')
      : bare.length === 0
        ? result('person_rule', 'pass', 'each person has a designation')
        : result('person_rule', 'fail', `person with no designation: ${bare.join(' ')}`),
  ];
};

/** For each entity in a group of duplicateIdentifiers, the reason that names the group. */
export const duplicatesOf = (
  entities: readonly Row[],
  identifiers: ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>,
): Map<string, string> => {
  const groups = duplicateIdentifiers(
    entities.map((one) => ({
      id: one['id'] ?? '',
      label: one['label'] ?? '',
      type: one['type'] ?? '',
      attrs: Object.fromEntries(
        [...(identifiers.get(one['id'] ?? '')?.entries() ?? [])].map(([key, v]) => [key, { v }]),
      ),
    })),
  );
  const reasons = new Map<string, string>();
  for (const group of groups)
    for (const one of group.entities)
      reasons.set(
        one.id,
        `${group.key} ${group.value} also on ${group.entities
          .filter((other) => other.id !== one.id)
          .map((other) => other.id)
          .join(' ')}`,
      );
  return reasons;
};

/** The verdict of a node: fail when one check fails, else incomplete when one could not run, else a
 * pass. Release mode gives release_pass, never pass. */
export const nodeVerdict = (
  results: readonly Result[],
  mode: 'release' | 'record',
): 'fail' | 'incomplete' | 'pass' | 'release_pass' => {
  if (results.some((one) => one.verdict === 'fail')) return 'fail';
  const open = results.some(
    (one) =>
      one.verdict === 'cannot_check' && !(mode === 'release' && one.reason === 'needs_record'),
  );
  if (open) return 'incomplete';
  return mode === 'release' ? 'release_pass' : 'pass';
};

/** The kind of decision of a claim, from its origin label. */
export const originKind = (label: string): string => {
  if (label.startsWith('Validated manually')) return 'operator';
  if (label.startsWith('Accepted by an AI reviewer')) return 'ai_reviewer';
  if (label.startsWith('Accepted by rule')) return 'rule';
  if (label.startsWith('Reference dataset')) return 'reference_dataset';
  if (label.startsWith('Proposed')) return 'proposed';
  return 'other';
};

export type { ReleaseFiles, Row };
