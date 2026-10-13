import { isDeepStrictEqual } from 'node:util';

import type { Cast, LinkEnd } from '@gab/proposal/mapping';
import type { CsvRecord } from '@gab/tools/csv';

import type { Queryable } from '../queryable.ts';
import { castCell, dayOf } from './cast.ts';
import { makeFinder, type ColumnCasts, type Found } from './join.ts';

// External constraint: GEM names a holder that is no entity with these words, for example
// "small shareholder(s)" and "natural person(s)". Such a holder goes to the report, and never into
// the record.
const NOT_AN_ENTITY = /^(small share ?holder|natural person|individual)(s|\(s\))?$/iu;

export type Value = string | number | boolean | string[];
export type Attrs = Record<string, { v: Value }>;
export type Rules = Readonly<Record<string, { readonly column: string; readonly cast: Cast }>>;
export interface Days {
  validFrom?: string;
  validTo?: string;
}
export type DayRule = { readonly column: string; readonly pattern: string } | undefined;

/** Casts each cell that a set of rules reads. A refused cell refuses the whole set, and a skipped
 * cell gives a note. */
export const castAll = (
  rules: Rules,
  cell: (name: string) => string,
  note: (reason: string) => void,
): { attrs: Attrs } | { refused: string } => {
  const attrs: Attrs = {};
  const pairedRegister = (key: string, rule: { column: string; cast: Cast }): boolean =>
    rule.cast.type === 'ru_register' &&
    Object.entries(rules).some(
      ([other, held]) =>
        other !== key && held.column === rule.column && held.cast.type === 'ru_register',
    );
  for (const [key, rule] of Object.entries(rules)) {
    const text = cell(rule.column);
    if (text === '') continue;
    const cast = castCell(rule.cast, key, text);
    if (cast.ok === 'skip') {
      // A register column that fills the tax number and the registration number gives one of
      // them in each row, and the other key is no fault of the row.
      if (!pairedRegister(key, rule))
        note(`the column "${rule.column}" gives no ${key}: ${cast.reason}`);
      continue;
    }
    if (!cast.ok) return { refused: `the column "${rule.column}": ${cast.reason}` };
    attrs[key] = { v: cast.value };
  }
  return { attrs };
};

export const daysOf = (
  cell: (name: string) => string,
  from: DayRule,
  to: DayRule,
): { days: Days } | { refused: string } => {
  const days: Days = {};
  for (const [name, rule] of [
    ['validFrom', from],
    ['validTo', to],
  ] as const) {
    if (rule === undefined || cell(rule.column) === '') continue;
    const day = dayOf(cell(rule.column), rule.pattern);
    if (day === null) return { refused: `"${cell(rule.column)}" is not a day as ${rule.pattern}` };
    days[name] = day;
  }
  return { days };
};

/** The words of what a lookup finds: the key, the entity and the outcome. `none` is the outcome
 * of a lookup that finds nothing. The load and the dry join word it the same way, for the entity
 * of a row and for the end of a relation. */
export const foundWords = (found: Found, none: string): [string, string, string] => {
  if (found.kind === 'one')
    return [found.key, found.id, found.key === 'label' ? 'finds by name only' : 'finds'];
  if (found.kind === 'many') return [found.key, '', `finds ${String(found.count)} entities`];
  return ['', '', none];
};

/** A finder for the ends of a relation table. A mapping gives no cast for an end, so a lookup by
 * a register number reads its cell as the Russian register cast does: a tax number that lost its
 * leading zero finds the company. */
export const makeEndFinder = (
  db: Queryable,
  header: readonly string[],
): ((record: CsvRecord, end: LinkEnd) => Promise<Found>) => {
  return (record, end) => {
    const casts: Record<string, { column: string; cast: Cast }> = {};
    for (const one of end.lookup)
      if (one.key === 'tax_id' || one.key === 'registration_number')
        casts[one.key] = { column: one.column, cast: { type: 'ru_register' } };
    const typed: ColumnCasts = casts;
    return makeFinder(db, typed, header)(record, end.lookup, end.entity_type);
  };
};

/** An end of a relation: the entity that a key finds, or the reason that the row goes to the
 * report. `found` is null when the row gives no entity to look up at this end. */
export type End =
  | { readonly id: string; readonly found: Found; readonly refused: null }
  | { readonly id: null; readonly found: Found | null; readonly refused: string };

/** Finds one end of a relation of a relation table. The load and the dry join both use it, so
 * they refuse the same rows. A relation creates no entity, and it is loaded only between two ends
 * that a key finds: a name is no key. */
export const resolveEnd = async (
  find: (record: CsvRecord, end: LinkEnd) => Promise<Found>,
  record: CsvRecord,
  cell: (name: string) => string,
  side: 'src' | 'dst',
  end: LinkEnd,
): Promise<End> => {
  const cells = [end.name, ...end.lookup.map((one) => one.column)]
    .flatMap((name) => (name === undefined ? [] : [cell(name)]))
    .filter((text) => text !== '');
  const holder = cells.find((text) => NOT_AN_ENTITY.test(text));
  if (holder !== undefined)
    return {
      id: null,
      found: null,
      refused: `relation not loaded: the ${side} "${holder}" is not an entity`,
    };
  const [named] = cells;
  if (named === undefined)
    return { id: null, found: null, refused: `relation not loaded: the row gives no ${side}` };
  const found = await find(record, end);
  if (found.kind === 'none')
    return {
      id: null,
      found,
      refused: `relation not loaded: the ${side} "${named}" is not in the record`,
    };
  if (found.kind === 'many')
    return {
      id: null,
      found,
      refused:
        `relation not loaded: the lookup of the ${side} by ${found.key} finds ` +
        `${String(found.count)} entities`,
    };
  if (found.key === 'label')
    return {
      id: null,
      found,
      refused: `relation not loaded: the ${side} "${named}" finds entity ${found.id} by its name only`,
    };
  return { id: found.id, found, refused: null };
};

/** The values of a relation that the record holds. `src` is the documents that cite a value. */
export type HeldAttrs = Readonly<
  Record<string, { readonly v: unknown; readonly src?: readonly string[] | undefined }>
>;

/** What a row adds to a relation that the record holds already. A value that the record holds
 * with another value is a conflict, and the operator reads it. A value that the record lacks, or
 * that this document does not cite yet, is an addition: it is proposed as an update of the
 * relation, and the citation of the row corroborates it. */
export const compareLink = (
  held: HeldAttrs,
  attrs: Attrs,
  document: string,
): { conflicts: string[]; additions: Attrs } => {
  const conflicts: string[] = [];
  const additions: Attrs = {};
  for (const [key, value] of Object.entries(attrs)) {
    const have = held[key];
    if (have === undefined) additions[key] = value;
    else if (!isDeepStrictEqual(have.v, value.v))
      conflicts.push(
        `${key} ${JSON.stringify(have.v)}, and the row gives ${JSON.stringify(value.v)}`,
      );
    else if (!(have.src ?? []).includes(document)) additions[key] = value;
  }
  return { conflicts, additions };
};

// External constraint: GEM writes the identifier of an entity as "E" and digits, and a
// share as a number with a percent sign.
const GEM_ENTITY = /\bE\d{6,}\b/gu;
const PERCENT = /(?<![\d.,])(\d+(?:\.\d+)?)\s*%/gu;
// A share with a comma as the decimal mark is not read. The part is refused, and the digits never
// leak into the name of the owner.
const COMMA_SHARE = /\d,\d+\s*%/u;

/** One owner of a split cell: its GEM identifier, the name that stands in the same part, and its
 * share in percent. */
export interface SplitOwner {
  readonly gemId: string;
  readonly name: string;
  readonly share: number;
}

/** Splits an owner cell. The cell splits only when every part holds exactly one GEM identifier and
 * exactly one share. A name is never paired with an identifier by its place in the cell: a part
 * that lacks one of the two refuses the whole cell. */
export const splitOwners = (
  text: string,
  separator: string,
): { owners: SplitOwner[] } | { refused: string } => {
  const owners: SplitOwner[] = [];
  for (const part of text.split(separator)) {
    const piece = part.trim();
    if (piece === '') continue;
    if (COMMA_SHARE.test(piece))
      return { refused: `the owner cell does not split: "${piece}" gives a share with a comma` };
    const ids = piece.match(GEM_ENTITY) ?? [];
    const shares = [...piece.matchAll(PERCENT)];
    const [gemId] = ids;
    const [share] = shares;
    if (ids.length !== 1 || gemId === undefined || shares.length !== 1 || share?.[1] === undefined)
      return {
        refused:
          `the owner cell does not split: "${piece}" does not hold exactly one GEM identifier ` +
          'and one share',
      };
    const name = piece
      .replace(GEM_ENTITY, '')
      .replace(PERCENT, '')
      .replace(/[[\](){},:]/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim();
    owners.push({ gemId, name: name === '' ? gemId : name, share: Number(share[1]) });
  }
  if (owners.length === 0) return { refused: 'the owner cell holds no owner' };
  const seen = new Set<string>();
  for (const owner of owners) {
    if (seen.has(owner.gemId))
      return { refused: `the owner cell does not split: ${owner.gemId} occurs more than one time` };
    seen.add(owner.gemId);
  }
  return { owners };
};
