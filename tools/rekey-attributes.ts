// Plans the re-key of drifted attribute keys in the pending proposals (spec #958):
//
//   pnpm rekey:attributes    dry run: prints how many items re-key and how many are held, and why
//
// The script edits no proposal and writes nothing. An item re-keys only when its excerpt carries the
// label that matches the key and the number as the page writes it. Any other item is held.

import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

import { CANONICAL_KEYS } from '@gab/tools/attribute-key';
import { connectionString } from './db-runtime.ts';

type Attrs = Readonly<Record<string, { readonly v: unknown }>>;

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

// The label of the quantity in the page. A bare "tonnage", NT and displacement are no label.
const LABEL: Readonly<Record<string, RegExp>> = {
  capacity_dwt: /\bdwt\b|\bdeadweight\b|дедвейт/iu,
  gross_tonnage_gt: /\bGT\b|\bgross\s+(?:tonnage|tons?)\b|валов/iu,
};

const SEPARATORS = /(?<=\d)[\s,.](?=\d{3}(?!\d))/gu;

/** The numbers that the text writes, without the separators of the thousands. */
const numbersIn = (text: string): string[] => text.replace(SEPARATORS, '').match(/\d+/gu) ?? [];

const hold = (reason: string): Plan => ({ kind: 'hold', reason });

const NOT_A_NAME = /^(?:n\/a|none|-+)$|^\d{7}$|\d{4}-\d{2}-\d{2}/iu;

/** The names of a text that lists them with " / ", or null when a part cannot be a name. */
const splitNames = (text: string, page: string): string[] | null => {
  const parts = text.split(' / ').map((one) => one.trim());
  const bad = parts.some(
    (one) => one === '' || NOT_A_NAME.test(one) || !page.toLowerCase().includes(one.toLowerCase()),
  );
  return bad ? null : parts;
};

export const plan = (item: Item): Plan => {
  const drifted = Object.keys(item.attrs).filter((key) => VARIANTS.has(key));
  if (drifted.length === 0) return { kind: 'keep' };
  const page = item.excerpts.join('\n');
  if (page === '') return hold('no stored excerpt');
  const numbers = new Set(numbersIn(page));
  const next: Record<string, { v: unknown }> = {};
  for (const [key, held] of Object.entries(item.attrs)) {
    const canonical = VARIANTS.get(key) ?? key;
    let value = held.v;
    const label = canonical !== key ? LABEL[canonical] : undefined;
    if (label !== undefined) {
      if (!label.test(page)) return hold(`the excerpt has no label for ${canonical}`);
      if (typeof value !== 'number' || !numbers.has(String(value)))
        return hold(`the number of ${key} is not in the excerpt`);
    }
    if (canonical === 'former_names' && typeof value === 'string') {
      const names = splitNames(value, page);
      if (names === null) return hold('a part of the former names cannot be split or checked');
      value = names;
    }
    const earlier = next[canonical];
    if (earlier !== undefined && JSON.stringify(earlier.v) !== JSON.stringify(value))
      return hold(`two values for ${canonical}`);
    next[canonical] = { ...held, v: value };
  }
  const dwt = next['capacity_dwt']?.v;
  const gt = next['gross_tonnage_gt']?.v;
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

// The pending acts that hold a drifted key, with the words of their cited spans. A citation of
// words read from an image has no span, so such an item has no excerpt and it is held.
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

const main = async (): Promise<number> => {
  const pool = new Pool({ connectionString: connectionString('app'), statement_timeout: 300_000 });
  try {
    const { rows } = await pool.query<Item>(READ, [[...VARIANTS.keys()]]);
    const { rekey, keep, held } = report(rows);
    console.log(`dry run: ${String(rekey)} to re-key, ${String(keep)} unchanged`);
    for (const [reason, count] of held) console.log(`held\t${String(count)}\t${reason}`);
    return 0;
  } finally {
    await pool.end();
  }
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  });
}
