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

import { createHash } from 'node:crypto';

import { isValidImo, isValidLei, isValidRuBic } from '@gab/proposal/identifiers';
import { refusedSource } from '@gab/tools/refused-source';
import {
  duplicateIdentifiers,
  plainIdentifier,
  UNIQUE_KEYS,
} from '@gab/tools/duplicate-identifier';
import { findExcerpt } from '@gab/tools/excerpt';

import { valuesOf, type ReleaseFiles } from './critical-nodes-replay.ts';

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
  'document_exists',
  'hash',
  'excerpt_at_page',
  'document_level',
] as const;

/** The checks of a node as a whole. */
export const NODE_CHECKS = ['no_duplicate', 'person_rule'] as const;

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
 * either side ("IMO9435337" holds 9435337), any other with no letter or digit on either side. */
export const holdsIdentifier = (text: string, identifier: string): boolean => {
  if (identifier === '') return false;
  const plain = text.replace(/[\s-]/gu, '').toUpperCase();
  const edge = /^\d+$/u.test(identifier) ? String.raw`\d` : String.raw`[\p{L}\p{N}]`;
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  return new RegExp(`(?<!${edge})${escaped}(?!${edge})`, 'u').test(plain);
};

export const excerptPresent = (claim: Claim): Result =>
  claim.citations.some((row) => excerptOf(row).trim() !== '')
    ? result('excerpt_present', 'pass', 'an excerpt is given')
    : result('excerpt_present', 'fail', 'no_excerpt');

/** An attribute: one excerpt holds each value (folded match). A relation: one excerpt names the far
 * end, by its label or one of its identifiers. A designation goes to designation_source. */
export const valueInExcerpt = (
  claim: Claim,
  identifiers: ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>,
): Result => {
  const check = 'value_in_excerpt';
  if (claim.kind === 'relation') {
    if (claim.relationType === 'designated_by')
      return result(check, 'not_applicable', 'checked by designation_source');
    const far = [...(identifiers.get(claim.object)?.values() ?? [])].flat();
    const named = claim.citations.some(
      (row) =>
        (claim.objectLabel !== '' && findExcerpt(excerptOf(row), claim.objectLabel) !== null) ||
        far.some((one) => holdsIdentifier(excerptOf(row), one)),
    );
    return named
      ? result(check, 'pass', 'an excerpt names the far end')
      : result(check, 'cannot_check', 'far_end_not_named');
  }
  let values: string[];
  try {
    values = valuesOf(claim.value);
  } catch {
    return result(check, 'fail', 'value_not_parsed');
  }
  if (values.length === 0) return result(check, 'not_applicable', 'no_value');
  const held = claim.citations.some((row) =>
    values.every((one) => findExcerpt(excerptOf(row), one) !== null),
  );
  if (held) return result(check, 'pass', 'an excerpt holds the value');
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
  const bad = valuesOf(claim.value).filter((one) => !valid(plainIdentifier(claim.attribute, one)));
  return bad.length === 0
    ? result(check, 'pass', `${claim.attribute} is well formed`)
    : result(check, 'fail', `bad ${claim.attribute}: ${bad.join(' ')}`);
};

const DAY = /^\d{4}(-\d{2}(-\d{2})?)?$/u;
const ACT_DATES = ['entry_into_force', 'adopted_on', 'ofac_action_id'];

/** The bounds of a relation are in ISO form and in order. A designation with no bound takes the date
 * of its act, so its act must have one. */
export const dates = (
  claim: Claim,
  actAttributes: ReadonlyMap<string, ReadonlySet<string>>,
): Result => {
  const check = 'dates';
  if (claim.kind !== 'relation') return result(check, 'not_applicable', 'not a relation');
  const row = claim.citations[0] ?? {};
  const from = row['valid_from'] ?? '';
  const to = row['valid_to'] ?? '';
  for (const one of [from, to])
    if (one !== '' && !DAY.test(one)) return result(check, 'fail', `bad_date: ${one}`);
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

/** What record mode reads for one document: its row, the hash of its stored bytes, and a page. */
export interface RecordReader {
  document(id: string): Promise<{ sha256: string; level: string; storedSha256: string } | null>;
  page(id: string, page: number): Promise<string | null>;
}

const sha256Of = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
export { sha256Of };

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
  const broken = found
    .filter(([, one]) => one !== null && one.sha256 !== one.storedSha256)
    .map(([id]) => id);
  let atPage = false;
  for (const row of claim.citations) {
    const text = await reader.page(row['document_id'] ?? '', Number(row['page'] ?? '0'));
    if (text !== null && excerptOf(row) !== '' && findExcerpt(text, excerptOf(row)) !== null) {
      atPage = true;
      break;
    }
  }
  const levelA = found.some(([, one]) => one?.level === 'A');
  return [
    missing.length === 0
      ? result('document_exists', 'pass', 'each cited document is in the record')
      : result('document_exists', 'fail', `absent: ${missing.join(' ')}`),
    missing.length === ids.length
      ? result('hash', 'cannot_check', 'no document')
      : broken.length === 0
        ? result('hash', 'pass', 'the stored bytes match the hash')
        : result('hash', 'fail', `hash differs: ${broken.join(' ')}`),
    atPage
      ? result('excerpt_at_page', 'pass', 'an excerpt is in the stored text at its page')
      : result('excerpt_at_page', 'fail', 'excerpt_not_at_page'),
    levelA
      ? result('document_level', 'pass', 'a cited document has level A')
      : result('document_level', 'fail', 'no_level_a_document'),
  ];
};

/** The node checks: no member shares a unique identifier with another entity, and a natural person
 * rests on a designation (research/signed-list.md, "All lines"). */
export const nodeChecks = (
  members: readonly string[],
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
