// Requalifies the promoted designated_by relations that state a sectoral measure (spec #506):
//
//   pnpm retype:relations           dry run: prints the report, proposes nothing
//   pnpm retype:relations --write   proposes the retype acts in three batches
//
// The batches go in this order: the US relations, the EU relations other than vessels, and the
// two ports of Annex XLVII. A vessel of Annex XLII stays designated_by (#505). A doubtful case
// goes to the report and is never proposed. A second run proposes nothing twice, because it
// skips a relation that is restricted_by already or that has a waiting retype act.

import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

import { findExcerpt } from '@gab/tools/excerpt';
import { propose } from '@gab/tools/propose';
import { connectionString } from './db-runtime.ts';

export type BatchName = 'us' | 'eu' | 'ports';

/** One promoted relation, its first excerpt and the newest stored text of that page. */
export interface Candidate {
  readonly relationId: string;
  readonly type: string;
  /** The entity type of the designated end. */
  readonly subjectType: string;
  /** The waiting act on the relation: none, a retype act, or any other act. */
  readonly waiting: 'none' | 'retype' | 'other';
  readonly originator: string;
  readonly document: string;
  readonly page: number;
  readonly excerpt: string;
  /** Null when the document has no stored text for the page. */
  readonly pageText: string | null;
}

export type Decision =
  | { readonly kind: 'retype'; readonly batch: BatchName; readonly reason: string }
  | { readonly kind: 'keep'; readonly batch?: undefined; readonly reason: string }
  | { readonly kind: 'doubtful'; readonly batch?: undefined; readonly reason: string };

const RETYPE_ANNEXES = new Set(['III', 'XIV', 'XLIV', 'XLV', 'XLVII']);
const doubt = (reason: string): Decision => ({ kind: 'doubtful', reason });

const ASSET_FREEZE = /\bSDN\b|blocked property|asset freeze|269\/2014/i;

/** The decision on one relation. Pure: the excerpt is checked against the stored text given. */
export const classify = (one: Candidate): Decision => {
  if (one.waiting !== 'none') return doubt('the relation has a waiting act');
  if (one.pageText === null || findExcerpt(one.pageText, one.excerpt) === null)
    return doubt('the stored text no longer holds the excerpt');

  const text = one.excerpt;
  const annexes = [...text.matchAll(/\bannex\s+([ivxlc]+)\b/gi)].map((m) =>
    (m[1] ?? '').toUpperCase(),
  );
  if (annexes.includes('XLII')) return { kind: 'keep', reason: 'a vessel of Annex XLII' };
  if (ASSET_FREEZE.test(text)) return { kind: 'keep', reason: 'a listing with an asset freeze' };

  const us = /\bdirective\s+\d+/i.test(text) && /\b(13662|14024)\b/.test(text);
  const article = /\barticle\s+5af\b/i.test(text);
  const eu = article || annexes.some((a) => RETYPE_ANNEXES.has(a));
  const unknown =
    annexes.some((a) => !RETYPE_ANNEXES.has(a)) ||
    (!article && /\barticles?\s+\d+/i.test(text)) ||
    (!us && /\bdirective\s+\d+/i.test(text));

  if (unknown) return doubt('unknown provision');
  if (!us && !eu)
    return doubt(
      one.subjectType === 'person'
        ? 'a person with no provision in the excerpt'
        : 'no provision in the excerpt',
    );
  if (us && eu) return doubt('the excerpt names the provisions of two regimes');
  if (us) return { kind: 'retype', batch: 'us', reason: 'an OFAC directive' };
  if (one.subjectType === 'vessel') return doubt('a vessel under a sectoral provision');
  if (annexes.includes('XLVII') && one.subjectType === 'port')
    return { kind: 'retype', batch: 'ports', reason: 'a port of Annex XLVII' };
  return { kind: 'retype', batch: 'eu', reason: 'a sectoral provision of 833/2014' };
};

interface Item {
  readonly ref: string;
  readonly act: {
    readonly op: 'update_relation';
    readonly targetId: string;
    readonly type: 'restricted_by';
  };
  readonly originator: string;
  readonly modality: 'enacts';
  readonly evidence: { document: string; page: number; excerpt: string }[];
}

export interface Sent {
  readonly name: BatchName;
  readonly items: readonly Item[];
}

export interface Report {
  readonly batches: readonly Sent[];
  readonly keep: readonly { relationId: string; reason: string }[];
  readonly doubtful: readonly { relationId: string; reason: string }[];
  readonly skipped: readonly { relationId: string; reason: string }[];
}

// The propose tool accepts this many items in one call.
const MAX_ITEMS = 50;
const ORDER: readonly BatchName[] = ['us', 'eu', 'ports'];

/** Classifies each candidate and, with `write`, sends the batches one after the other. */
export const requalify = async (
  candidates: readonly Candidate[],
  options: { readonly write: boolean; readonly send: (batch: Sent) => void | Promise<void> },
): Promise<Report> => {
  const grouped: Record<BatchName, Item[]> = { us: [], eu: [], ports: [] };
  const keep: Report['keep'][number][] = [];
  const doubtful: Report['doubtful'][number][] = [];
  const skipped: Report['skipped'][number][] = [];
  let count = 0;
  for (const one of candidates) {
    const { relationId } = one;
    if (one.type !== 'designated_by') skipped.push({ relationId, reason: `already ${one.type}` });
    else if (one.waiting === 'retype') skipped.push({ relationId, reason: 'a retype act waits' });
    else {
      const decision = classify(one);
      if (decision.kind === 'keep') keep.push({ relationId, reason: decision.reason });
      else if (decision.kind === 'doubtful') doubtful.push({ relationId, reason: decision.reason });
      else {
        count += 1;
        grouped[decision.batch].push({
          ref: `r${String(count)}`,
          act: { op: 'update_relation', targetId: relationId, type: 'restricted_by' },
          originator: one.originator,
          modality: 'enacts',
          evidence: [{ document: one.document, page: one.page, excerpt: one.excerpt }],
        });
      }
    }
  }
  const batches = ORDER.map((name) => ({ name, items: grouped[name] }));
  if (options.write)
    for (const { name, items } of batches)
      for (let from = 0; from < items.length; from += MAX_ITEMS)
        await options.send({ name, items: items.slice(from, from + MAX_ITEMS) });
  return { batches, keep, doubtful, skipped };
};

// ------------------------------------------------------------------------ the record -----

// The promoted designated_by relations with the first citation of the act that made each one,
// the newest stored text of the cited page, and the act that waits on the relation, if any.
// The excerpt is the cited span of the cited set; a moved passage shows as a doubtful case.
const READ = `SELECT r.id::text AS relation_id, r.type, e.type AS subject_type,
    coalesce(w.kind, 'none') AS waiting, coalesce(o.originator, '') AS originator,
    c.doc_id AS document, c.page,
    substr(t.text, c.start + 1, c."end" - c.start) AS excerpt,
    n.text AS page_text
  FROM public.relations r
  JOIN public.entities e ON e.id = r.src_id AND r.src_kind = 'entity'
  LEFT JOIN public.proposals o ON o.id = r.promoted_from
  JOIN LATERAL (SELECT * FROM public.citation WHERE claim_id = r.promoted_from
                 AND start IS NOT NULL ORDER BY created_at, id LIMIT 1) c ON true
  JOIN public.document_text t ON t.document_id = c.doc_id AND t.extractor = c.text_extractor
                              AND t.page = c.page
  LEFT JOIN public.document_text n ON n.document_id = c.doc_id AND c.page = n.page
                              AND n.extractor = public.newest_text_extractor(c.doc_id)
  LEFT JOIN LATERAL (SELECT CASE WHEN bool_or(p.payload->>'type' = 'restricted_by')
                                 THEN 'retype' ELSE 'other' END AS kind
                       FROM public.proposals p
                      WHERE p.status = 'pending' AND p.target_kind = 'relation'
                        AND p.target_id = r.id) w ON true
  WHERE r.type = 'designated_by'`;

const main = async (): Promise<number> => {
  const write = argv.slice(2).includes('--write');
  const reader = new Pool({ connectionString: connectionString('app') });
  const writer = new Pool({ connectionString: connectionString('research') });
  try {
    const { rows } = await reader.query<Record<string, string | number | null>>(READ);
    const candidates = rows.map((row): Candidate => ({
      relationId: String(row['relation_id']),
      type: String(row['type']),
      subjectType: String(row['subject_type']),
      waiting: row['waiting'] as Candidate['waiting'],
      originator: String(row['originator']),
      document: String(row['document']),
      page: Number(row['page']),
      excerpt: String(row['excerpt']),
      pageText: row['page_text'] === null ? null : String(row['page_text']),
    }));
    const report = await requalify(candidates, {
      write,
      send: async ({ name, items }) => {
        await propose.run(writer, { items: [...items] });
        console.log(`batch ${name}: ${String(items.length)} retype acts proposed`);
      },
    });
    for (const { name, items } of report.batches)
      console.log(`${name}: ${String(items.length)} to retype${write ? '' : ' (dry run)'}`);
    for (const [title, list] of [
      ['keep', report.keep],
      ['skipped', report.skipped],
      ['doubtful', report.doubtful],
    ] as const)
      for (const one of list) console.log(`${title}\t${one.relationId}\t${one.reason}`);
    return 0;
  } finally {
    await reader.end();
    await writer.end();
  }
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  });
}
