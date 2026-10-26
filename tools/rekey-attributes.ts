// Plans the re-key of drifted attribute keys in the pending proposals (spec #958):
//
//   pnpm rekey:attributes                    dry run: prints how many items re-key, how many are
//                                            held and why, and the groups that move together
//   pnpm rekey:attributes --write [--limit N]   sends the corrected acts of the first N groups
//                                            (one by default), then rejects the old acts
//
// The script edits no proposal. An item re-keys only when its excerpt carries the label that
// matches the key and the number as the page writes it. Any other item is held. The write step is
// in rekey-write.ts.

import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { z } from 'zod';

import { CANONICAL_KEYS } from '@gab/tools/attribute-key';
import { UNIQUE_KEYS } from '@gab/tools/duplicate-identifier';
import { connectionString } from './db-runtime.ts';
import { apply, checkLines, doorsOf, readGroups } from './rekey-write.ts';

export type Attrs = Readonly<Record<string, { readonly v: unknown }>>;

/** The stored text of one page that an act cites. */
export interface Page {
  readonly document: string;
  readonly page: number;
  readonly text: string;
}

/** Words of a stored page, copied as they stand, that an act can cite. */
export interface Passage {
  readonly document: string;
  readonly page: number;
  readonly excerpt: string;
}

/** One pending act with attributes, and the excerpts that it cites. The pages are the stored text
 * of the cited pages: an excerpt that lacks the label and the number is replaced by a passage of
 * the page that has both. */
export interface Item {
  readonly id: string;
  readonly attrs: Attrs;
  readonly excerpts: readonly string[];
  readonly pages?: readonly Page[];
}

export type Plan =
  | { readonly kind: 'keep' }
  | {
      readonly kind: 'rekey';
      readonly attrs: Attrs;
      readonly renamed: readonly string[];
      /** The passages of the pages that the new act cites besides the old excerpts. */
      readonly extra?: readonly Passage[];
    }
  | { readonly kind: 'hold'; readonly reason: string };

const VARIANTS = new Map(
  Object.entries(CANONICAL_KEYS).flatMap(([key, list]) => list.map((one) => [one, key] as const)),
);

/** The keys that the plan renames. */
export const DRIFTED_KEYS: readonly string[] = [...VARIANTS.keys()];

// The label of the quantity in the page. A bare "tonnage", NT and displacement are no label. A
// Cyrillic word has no word boundary in JavaScript, so it stands without one.
const LABEL: Readonly<Record<string, string>> = {
  capacity_dwt: String.raw`\bDWT\b|\bdwt\b|[Dd]ead[Ww]eight|[Дд]едвейт`,
  gross_tonnage_gt: String.raw`\bGT\b|[Gg]ross\s{1,5}(?:[Tt]onnage|[Tt]ons?)|[Вв]аловая\s+вместимость`,
};

const SEPARATORS = /(?<=\d)[\s,.](?=\d{3}(?!\d))/gu;

/** The page, with the separators of the thousands taken out of each number. */
const squeezed = (text: string): string => text.replace(SEPARATORS, '');

/** The label stands in front of the number with no digit between them, or the number stands in
 * front of the label with only a unit between them. A number that belongs to another label does
 * not count. */
const labelled = (label: string, value: number, page: string): boolean => {
  const number = String.raw`(?<!\d)${String(value)}(?!\d)`;
  return new RegExp(
    String.raw`(?:${label})\D{0,25}${number}|${number}\s?(?:t|tons?|tonnes)?\s?(?:${label})`,
    'u',
  ).test(squeezed(page));
};

// The number as a page writes it: the digits, with a space, a comma or a point between the groups.
const numberPattern = (value: number): string =>
  String(value)
    .replace(/\B(?=(?:\d{3})+(?!\d))/gu, ' ')
    .split(' ')
    .join(String.raw`[ \t,.]?`);

// The label, then a unit and signs and no letter (a line pair such as "Gross tonnage (t)" and the
// next line). A line break may stand between them; it never stands inside a number.
const opening = (label: string): string =>
  String.raw`(?:${label})[^\p{L}\d]{0,12}(?:t|tons?|tonnes)?[^\p{L}\d]{0,12}`;

/** A passage of a page that opens with the label and ends with the number. The number is the whole
 * number: more digits, a decimal tail or a slash after it (a line such as "DWT/GT: 115 000 / 42
 * 500") make no passage. Null when no page has such a passage. */
export const passageOf = (label: string, value: number, pages: readonly Page[]): Passage | null => {
  const found = new RegExp(
    String.raw`${opening(label)}(?<!\d)${numberPattern(value)}(?![ \t,.]?\d)(?!\s*/)`,
    'u',
  );
  for (const one of pages) {
    const excerpt = found.exec(one.text)?.[0];
    if (excerpt !== undefined) return { document: one.document, page: one.page, excerpt };
  }
  return null;
};

/** The deadweight and the gross tonnage that an act proposes, and the first number that the stored
 * page writes after each label. It only reads: it swaps nothing. */
export const valuesOf = (
  item: Item,
): {
  readonly proposed: Readonly<Record<string, unknown>>;
  readonly page: Record<string, number>;
} => {
  const proposed: Record<string, unknown> = {};
  for (const [key, held] of Object.entries(item.attrs)) {
    const canonical = VARIANTS.get(key) ?? key;
    if (canonical in LABEL) proposed[canonical] = held.v;
  }
  const page: Record<string, number> = {};
  for (const [canonical, label] of Object.entries(LABEL)) {
    const found = new RegExp(String.raw`${opening(label)}(\d(?:[ \t,.]?\d)*)`, 'u');
    for (const one of item.pages ?? []) {
      const digits = found.exec(one.text)?.[1]?.replace(/[ \t,.]/gu, '');
      if (digits !== undefined) {
        page[canonical] = Number(digits);
        break;
      }
    }
  }
  return { proposed, page };
};

// The types of vessel whose deadweight is often below the gross tonnage: gas carriers, passenger
// ships and ferries, and vehicle carriers. The words that mark a type of cargo ship, where a
// deadweight below the gross tonnage is a doubt.
const TYPE_ALLOWS =
  /\b(?:LNG carrier|LNG tanker|LPG carrier|LPG tanker|gas carrier|gas tanker|passenger ship|passenger vessel|passenger ferry|cruise ship|ro-?pax|car carrier|vehicle carrier|PCTC)\b/giu;
const TYPE_BLOCKS =
  /\b(?:crude|oil tanker|product tanker|chemical tanker|bulk[- ]?carrier|bulker|bulk|general cargo|cargo ship|cargo vessel|container ?ship|multi-?purpose|heavy[- ]lift|reefer|ore carrier)\b/giu;

/** The words of the stored pages that name a type of vessel, for each list. */
export const vesselTypes = (
  pages: readonly Page[],
): { readonly allows: string[]; readonly blocks: string[] } => {
  const text = pages.map((one) => one.text).join('\n');
  const found = (words: RegExp): string[] => [
    ...new Set([...text.matchAll(words)].map((one) => one[0].toLowerCase())),
  ];
  return { allows: found(TYPE_ALLOWS), blocks: found(TYPE_BLOCKS) };
};

/** A deadweight below the gross tonnage is released when the page writes each of the two values
 * under its label, equal to the proposed values, and its type of vessel is in the first list and
 * in no word of the second. The value is a fact of the source; the type tells that it is normal. */
const pageAllows = (item: Item, dwt: number, gt: number): boolean => {
  const { page } = valuesOf(item);
  if (page['capacity_dwt'] !== dwt || page['gross_tonnage_gt'] !== gt) return false;
  const types = vesselTypes(item.pages ?? []);
  return types.allows.length > 0 && types.blocks.length === 0;
};

/** The reasons that a person reads in the dry run. */
export const SMALLER_HOLD = 'the deadweight is smaller than the gross tonnage';
export const DUPLICATE_HOLD = 'the entity copies a duplicate identifier';

const hold = (reason: string): Plan => ({ kind: 'hold', reason });

// An empty part, a placeholder, a year, an IMO number or a date is no name.
const NOT_A_NAME =
  /^(?:n\/a|none|unknown|-+|\d{4})$|(?<!\p{L})IMO(?!\p{L})|^\d{7}$|\d{1,4}[-./]\d{1,2}[-./]\d{1,4}/iu;

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** Each name of a text that lists them with " / ", or of a list. Null when a name is no name, or
 * when the page does not write it as a whole word. */
const checkedNames = (given: string | readonly unknown[], page: string): string[] | null => {
  const parts = (typeof given === 'string' ? given.split(' / ') : given).map((one) =>
    typeof one === 'string' ? one.trim() : '',
  );
  // A name with a bracket that does not close came from a " / " inside a bracket: hold it.
  const bad =
    new Set(parts).size !== parts.length ||
    parts.some(
      (one) =>
        one.length < 2 ||
        one.split('(').length !== one.split(')').length ||
        NOT_A_NAME.test(one) ||
        !new RegExp(String.raw`(?<![\p{L}\p{N}])${escaped(one)}(?![\p{L}\p{N}])`, 'u').test(page),
    );
  return bad ? null : parts;
};

/** The keys whose value is a number in the record. */
const NUMBER_KEYS: readonly string[] = [
  'build_year',
  'length_m',
  'capacity_dwt',
  'gross_tonnage_gt',
];

/** The keys that the plan reads when they hold a text. */
export const TEXT_KEYS: readonly string[] = ['former_names', ...NUMBER_KEYS];

// No leading zero: "007" would lose its zeros, and a text must keep what it wrote.
const PLAIN_NUMBER = /^(?:0|[1-9]\d*)(?:\.\d+)?$/u;

/** The text stands in the page as a whole number: no digit, point, comma, hyphen, slash or letter
 * joins it to another token, and no space joins it to a group of digits (115 in "115 000"). */
const carries = (text: string, page: string): boolean =>
  new RegExp(
    String.raw`(?<![\d.,\-/\p{L}])(?<!\d[ \t])${escaped(text)}(?![\d\-/\p{L}]|[.,]\d|[ \t]\d{3}(?!\d))`,
    'u',
  ).test(page);

export const plan = (item: Item): Plan => {
  // A key that holds a text where the record holds a list or a number is drifted too: the key is
  // the right one, the form is not.
  const drifted = Object.keys(item.attrs).filter(
    (key) =>
      VARIANTS.has(key) || (TEXT_KEYS.includes(key) && typeof item.attrs[key]?.v === 'string'),
  );
  if (drifted.length === 0) return { kind: 'keep' };
  const page = item.excerpts.join('\n');
  const pages = item.pages ?? [];
  if (page === '' && pages.length === 0) return hold('no stored excerpt');
  const next: Record<string, { v: unknown }> = {};
  const extra: Passage[] = [];
  for (const [key, held] of Object.entries(item.attrs)) {
    const canonical = VARIANTS.get(key) ?? key;
    let value = held.v;
    // A plain number that was sent as a text becomes a number. The text itself must stand in the
    // excerpt. Any other text is held: nothing is guessed (a unit, a separator, a range).
    let written: string | null = null;
    if (typeof value === 'string' && NUMBER_KEYS.includes(canonical)) {
      const text = value.trim();
      if (!PLAIN_NUMBER.test(text)) return hold(`the text of ${key} is not a plain number`);
      if (Number(text) === 0) return hold(`the text of ${key} is zero`);
      if (canonical === 'build_year' && !/^\d{4}$/u.test(text))
        return hold(`the text of ${key} is not a four-digit year`);
      written = text;
      value = Number(text);
    }
    const label = canonical !== key ? LABEL[canonical] : undefined;
    if (label === undefined && written !== null && !carries(written, page))
      return hold(`the excerpt does not carry the number of ${key}`);
    if (label !== undefined) {
      const unclear = hold(`the excerpt does not give the number of ${key} next to its label`);
      if (typeof value !== 'number') return unclear;
      if (!labelled(label, value, page)) {
        // The excerpt is poor: the stored page may hold the label and the same number.
        const passage = passageOf(label, value, pages);
        if (passage === null) return unclear;
        extra.push(passage);
      }
    }
    if (
      canonical === 'former_names' &&
      (canonical !== key || typeof value === 'string') &&
      (typeof value === 'string' || Array.isArray(value))
    ) {
      const names = checkedNames(value, page);
      if (names === null) return hold('a former name cannot be split or checked');
      value = names;
    }
    const earlier = next[canonical];
    if (earlier !== undefined && JSON.stringify(earlier.v) !== JSON.stringify(value))
      return hold(`two values for ${canonical}`);
    next[canonical] = { ...held, v: value };
  }
  const dwt = next['capacity_dwt']?.v;
  const gt = next['gross_tonnage_gt']?.v;
  // shortcut: the check holds each vessel type, and the spec names tankers and bulkers; it only
  // holds more, so keep it until the held count shows that it costs too much.
  if (typeof dwt === 'number' && typeof gt === 'number' && dwt < gt && !pageAllows(item, dwt, gt))
    return hold(SMALLER_HOLD);
  return {
    kind: 'rekey',
    attrs: next,
    renamed: drifted,
    ...(extra.length === 0 ? {} : { extra }),
  };
};

export interface Report {
  readonly rekey: number;
  readonly keep: number;
  readonly held: ReadonlyMap<string, number>;
}

export const report = (items: readonly Item[]): Report => {
  let rekey = 0;
  let keep = 0;
  const held = new Map<string, number>();
  for (const one of items) {
    const decision = plan(one);
    if (decision.kind === 'rekey') rekey += 1;
    else if (decision.kind === 'keep') keep += 1;
    else held.set(decision.reason, (held.get(decision.reason) ?? 0) + 1);
  }
  return { rekey, keep, held };
};

const row = z.strictObject({
  id: z.string(),
  attrs: z.record(z.string(), z.looseObject({ v: z.unknown() })),
  excerpts: z.array(z.string()),
  pages: z.array(z.object({ document: z.string(), page: z.number(), text: z.string() })),
});

// The pending acts that hold a drifted key, with the words of their cited spans. A citation of
// words read from an image has no span, so such an item has no excerpt and it is held. The read
// takes the raw payload with no privacy view: the dry run prints counts, ids and tonnages only.
export const READ = `SELECT p.id::text AS id, p.payload->'attrs' AS attrs,
    coalesce(cs.excerpts, '[]'::json) AS excerpts, coalesce(pg.pages, '[]'::jsonb) AS pages
  FROM public.proposals p
  LEFT JOIN LATERAL (
    SELECT json_agg(substr(t.text, c.start + 1, c."end" - c.start) ORDER BY c.created_at, c.id)
             AS excerpts
      FROM public.citation c
      JOIN public.document_text t ON t.document_id = c.doc_id
                                 AND t.extractor = c.text_extractor AND t.page = c.page
     WHERE c.claim_id = p.id AND c.start IS NOT NULL) cs ON true
  LEFT JOIN LATERAL (
    -- Each cited page once, whatever the number of citations on it.
    SELECT jsonb_agg(jsonb_build_object('document', x.doc_id, 'page', x.page, 'text', t.text))
             AS pages
      FROM (SELECT DISTINCT c.doc_id, c.page, c.text_extractor FROM public.citation c
             WHERE c.claim_id = p.id AND c.start IS NOT NULL) x
      JOIN public.document_text t ON t.document_id = x.doc_id
                                 AND t.extractor = x.text_extractor AND t.page = x.page) pg ON true
 WHERE p.status = 'pending'
   AND (p.payload->'attrs' ?| $1::text[]
        OR EXISTS (SELECT 1 FROM unnest($2::text[]) k(key)
                    WHERE jsonb_typeof(p.payload->'attrs'->k.key->'v') = 'string'))
 ORDER BY p.id`;

const limitOf = (): number => {
  const at = argv.indexOf('--limit');
  const given = at < 0 ? 1 : Number(argv[at + 1]);
  if (!Number.isInteger(given) || given < 1)
    throw new Error('--limit takes a whole number, 1 or more');
  return given;
};

const main = async (): Promise<number> => {
  const write = argv.includes('--write');
  const limit = limitOf();
  const pool = new Pool({ connectionString: connectionString('app'), statement_timeout: 300_000 });
  // The research role proposes. The dry run never opens it.
  const writer = new Pool({ connectionString: connectionString('research') });
  try {
    const found = await pool.query(READ, [[...VARIANTS.keys()], [...TEXT_KEYS]]);
    const { rekey, keep, held } = report(found.rows.map((one) => row.parse(one)));
    console.log(
      `${write ? 'write' : 'dry run'}: ${String(rekey)} to re-key, ${String(keep)} unchanged`,
    );
    for (const [reason, count] of held) console.log(`held	${String(count)}	${reason}`);
    const groups = await readGroups(pool, UNIQUE_KEYS, DRIFTED_KEYS);
    // Lists for a person: the acts that the script does not touch.
    for (const one of groups) {
      if (one.held === SMALLER_HOLD) for (const line of checkLines(one)) console.log(line);
      if (one.held === DUPLICATE_HOLD)
        console.log(`duplicate	${one.key}	${one.moved.map((act) => act.id).join(' ')}`);
    }
    for (const one of groups)
      console.log(
        `group	${one.key}	${String(one.moved.length)} moved	${String(one.pass.length)} kept	` +
          (one.held ?? 'ready'),
      );
    const reasons = new Map<string, number>();
    for (const one of groups) {
      const why = one.held ?? 'ready';
      reasons.set(why, (reasons.get(why) ?? 0) + 1);
    }
    for (const [why, count] of reasons) console.log(`groups	${String(count)}	${why}`);
    if (!write) return 0;
    const doors = doorsOf(writer, pool);
    for (const one of groups.filter((group) => group.held === null).slice(0, limit)) {
      const done = await apply(one, doors);
      console.log(
        `${done.status}	${done.key}	${String(done.sent)} sent	${String(done.rejected)} rejected` +
          (done.reason === undefined ? '' : `	${done.reason}`),
      );
    }
    return 0;
  } finally {
    await pool.end();
    await writer.end();
  }
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  });
}
