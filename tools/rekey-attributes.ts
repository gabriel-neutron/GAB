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
import { apply, doorsOf, readGroups } from './rekey-write.ts';

export type Attrs = Readonly<Record<string, { readonly v: unknown }>>;

/** One pending act with attributes, and the excerpts that it cites. */
export interface Item {
  readonly id: string;
  readonly attrs: Attrs;
  readonly excerpts: readonly string[];
}

export type Plan =
  | { readonly kind: 'keep' }
  | { readonly kind: 'rekey'; readonly attrs: Attrs; readonly renamed: readonly string[] }
  | { readonly kind: 'hold'; readonly reason: string };

const VARIANTS = new Map(
  Object.entries(CANONICAL_KEYS).flatMap(([key, list]) => list.map((one) => [one, key] as const)),
);

// The label of the quantity in the page. A bare "tonnage", NT and displacement are no label. A
// Cyrillic word has no word boundary in JavaScript, so it stands without one.
const LABEL: Readonly<Record<string, string>> = {
  capacity_dwt: String.raw`\bDWT\b|\bdwt\b|[Dd]ead[Ww]eight|[Дд]едвейт`,
  gross_tonnage_gt: String.raw`\bGT\b|[Gg]ross\s+(?:[Tt]onnage|[Tt]ons?)|[Вв]аловая\s+вместимость`,
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

const hold = (reason: string): Plan => ({ kind: 'hold', reason });

// An empty part, a placeholder, a year, an IMO number or a date is no name.
const NOT_A_NAME = /^(?:n\/a|none|unknown|-+|\d{4})$|IMO|^\d{7}$|\d{1,4}[-./]\d{1,2}[-./]\d{1,4}/iu;

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/** Each name of a text that lists them with " / ", or of a list. Null when a name is no name, or
 * when the page does not write it as a whole word. */
const checkedNames = (given: string | readonly unknown[], page: string): string[] | null => {
  const parts = (typeof given === 'string' ? given.split(' / ') : given).map((one) =>
    typeof one === 'string' ? one.trim() : '',
  );
  const bad = parts.some(
    (one) =>
      one.length < 2 ||
      NOT_A_NAME.test(one) ||
      !new RegExp(String.raw`(?<![\p{L}\p{N}])${escaped(one)}(?![\p{L}\p{N}])`, 'iu').test(page),
  );
  return bad ? null : parts;
};

export const plan = (item: Item): Plan => {
  const drifted = Object.keys(item.attrs).filter((key) => VARIANTS.has(key));
  if (drifted.length === 0) return { kind: 'keep' };
  const page = item.excerpts.join('\n');
  if (page === '') return hold('no stored excerpt');
  const next: Record<string, { v: unknown }> = {};
  for (const [key, held] of Object.entries(item.attrs)) {
    const canonical = VARIANTS.get(key) ?? key;
    let value = held.v;
    const label = canonical !== key ? LABEL[canonical] : undefined;
    if (label !== undefined) {
      if (typeof value !== 'number' || !labelled(label, value, page))
        return hold(`the excerpt does not give the number of ${key} next to its label`);
    }
    if (
      canonical === 'former_names' &&
      canonical !== key &&
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
  if (typeof dwt === 'number' && typeof gt === 'number' && dwt < gt)
    return hold('the deadweight is smaller than the gross tonnage');
  return { kind: 'rekey', attrs: next, renamed: drifted };
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
});

// The pending acts that hold a drifted key, with the words of their cited spans. A citation of
// words read from an image has no span, so such an item has no excerpt and it is held. The read
// takes the raw payload with no privacy view: the dry run prints counts only.
export const READ = `SELECT p.id::text AS id, p.payload->'attrs' AS attrs,
    coalesce(cs.excerpts, '[]'::json) AS excerpts
  FROM public.proposals p
  LEFT JOIN LATERAL (
    SELECT json_agg(substr(t.text, c.start + 1, c."end" - c.start) ORDER BY c.created_at, c.id)
             AS excerpts
      FROM public.citation c
      JOIN public.document_text t ON t.document_id = c.doc_id
                                 AND t.extractor = c.text_extractor AND t.page = c.page
     WHERE c.claim_id = p.id AND c.start IS NOT NULL) cs ON true
 WHERE p.status = 'pending' AND p.payload->'attrs' ?| $1::text[]
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
    const found = await pool.query(READ, [[...VARIANTS.keys()]]);
    const { rekey, keep, held } = report(found.rows.map((one) => row.parse(one)));
    console.log(
      `${write ? 'write' : 'dry run'}: ${String(rekey)} to re-key, ${String(keep)} unchanged`,
    );
    for (const [reason, count] of held) console.log(`held	${String(count)}	${reason}`);
    const groups = await readGroups(pool, UNIQUE_KEYS);
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
