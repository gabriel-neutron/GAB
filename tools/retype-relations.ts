// Requalifies the promoted designated_by relations that state a sectoral measure (spec #506):
//
//   pnpm retype:relations           dry run: prints the report, proposes nothing
//   pnpm retype:relations --write   proposes the retype acts in three batches
//
// The batches go in this order: the US relations, the EU relations other than vessels, and the
// two ports of Annex XLVII. A vessel of Annex XLII stays designated_by (#505). A doubtful case
// goes to the report and is never proposed. A second run proposes nothing twice, because it
// reads only designated_by relations and skips a relation that has a waiting retype act. A
// relation with a rejected retype act is a doubtful case.

import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';

import { findExcerpt } from '@gab/tools/excerpt';
import { propose } from '@gab/tools/propose';
import { connectionString } from './db-runtime.ts';

export type BatchName = 'us' | 'eu' | 'ports';

/** One citation of a promoted relation and the newest stored text of its page. */
export interface Cite {
  readonly document: string;
  readonly page: number;
  readonly excerpt: string;
  /** Null when the document has no stored text for the page. */
  readonly pageText: string | null;
}

/** One promoted designated_by relation and all its citations. */
export interface Candidate {
  readonly relationId: string;
  /** The entity type of the designated end. */
  readonly subjectType: string;
  /** The act that waits on the relation: none, a retype act, any other act, or a rejected retype. */
  readonly waiting: 'none' | 'retype' | 'other' | 'rejected';
  /** Another open designated_by or restricted_by relation links the same two ends. */
  readonly collides: boolean;
  readonly originator: string;
  readonly cites: readonly Cite[];
}

export type Decision =
  | { readonly kind: 'retype'; readonly batch: BatchName; readonly reason: string }
  | { readonly kind: 'keep'; readonly batch?: undefined; readonly reason: string }
  | { readonly kind: 'doubtful'; readonly batch?: undefined; readonly reason: string };

const RETYPE_ANNEXES = new Set(['III', 'XIV', 'XLIV', 'XLV', 'XLVII']);
const doubt = (reason: string): Decision => ({ kind: 'doubtful', reason });

const ASSET_FREEZE = /\bSDN\b|blocked property|asset freeze|269\/2014/i;

/** The decision on one citation. Pure: the excerpt is checked against the stored text given. */
const classifyCite = (cite: Cite, subjectType: string): Decision => {
  if (cite.pageText === null || findExcerpt(cite.pageText, cite.excerpt) === null)
    return doubt('the stored text no longer holds the excerpt');

  const text = cite.excerpt;
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
      subjectType === 'person'
        ? 'a person with no provision in the excerpt'
        : 'no provision in the excerpt',
    );
  if (eu && !text.includes('833/2014'))
    return doubt('an EU provision without 833/2014 in the excerpt');
  if (us && eu) return doubt('the excerpt names the provisions of two regimes');
  if (us) return { kind: 'retype', batch: 'us', reason: 'an OFAC directive' };
  if (subjectType === 'vessel') return doubt('a vessel under a sectoral provision');
  if (annexes.includes('XLVII') && subjectType === 'port')
    return { kind: 'retype', batch: 'ports', reason: 'a port of Annex XLVII' };
  return { kind: 'retype', batch: 'eu', reason: 'a sectoral provision of 833/2014' };
};

/** The decision on one relation: the decision of each citation, and all must agree. */
export const classify = (one: Candidate): Decision => {
  if (one.waiting === 'rejected') return doubt('a retype act of the relation was rejected');
  if (one.waiting !== 'none') return doubt('the relation has a waiting act');
  if (one.collides) return doubt('another open relation links the same ends');
  const [first, ...rest] = one.cites.map((cite) => classifyCite(cite, one.subjectType));
  if (first === undefined) return doubt('no usable citation');
  const bad = [first, ...rest].find((one) => one.kind === 'doubtful');
  if (bad !== undefined) return bad;
  if (rest.some((next) => next.kind !== first.kind || next.batch !== first.batch))
    return doubt('the citations do not agree on a decision');
  return first;
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
    if (one.waiting === 'retype') skipped.push({ relationId, reason: 'a retype act waits' });
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
          evidence: one.cites.map(({ document, page, excerpt }) => ({ document, page, excerpt })),
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

// The promoted designated_by relations with ALL the citations of the act that made each one, the
// newest stored text of each cited page, the act that waits on or was rejected for the relation,
// and whether another open relation links the same ends. The excerpt is the cited span of the
// cited set; a moved passage shows as a doubtful case. The joins are LEFT joins, so a relation
// with no usable citation or no stored text still shows in the report as a doubtful case.
// The script reads the record in SQL because the read API gives no citations and no text.
export const READ = `SELECT r.id::text AS relation_id, e.type AS subject_type,
    coalesce(w.kind, 'none') AS waiting, coalesce(o.originator, '') AS originator,
    EXISTS (SELECT 1 FROM public.relations x
             WHERE x.id <> r.id AND x.type IN ('designated_by', 'restricted_by')
               AND x.valid_to IS NULL
               AND x.src_kind = r.src_kind AND x.src_id = r.src_id
               AND x.dst_kind = r.dst_kind AND x.dst_id = r.dst_id) AS collides,
    coalesce(cs.cites, '[]'::json) AS cites
  FROM public.relations r
  JOIN public.entities e ON e.id = r.src_id AND r.src_kind = 'entity'
  LEFT JOIN public.proposals o ON o.id = r.promoted_from
  LEFT JOIN LATERAL (
    SELECT json_agg(json_build_object(
             'document', c.doc_id, 'page', c.page,
             'excerpt', coalesce(substr(t.text, c.start + 1, c."end" - c.start), ''),
             'pageText', CASE WHEN t.text IS NULL THEN NULL ELSE n.text END)
           ORDER BY c.created_at, c.id) AS cites
      FROM public.citation c
      LEFT JOIN public.document_text t ON t.document_id = c.doc_id
                                      AND t.extractor = c.text_extractor AND t.page = c.page
      LEFT JOIN public.document_text n ON n.document_id = c.doc_id AND n.page = c.page
                                      AND n.extractor = public.newest_text_extractor(c.doc_id)
     WHERE c.claim_id = r.promoted_from AND c.start IS NOT NULL) cs ON true
  LEFT JOIN LATERAL (
    SELECT CASE WHEN bool_or(p.status = 'pending' AND p.payload->>'type' = 'restricted_by')
                THEN 'retype'
                WHEN bool_or(p.status = 'pending') THEN 'other'
                WHEN bool_or(p.payload->>'type' = 'restricted_by') THEN 'rejected' END AS kind
      FROM public.proposals p
     WHERE p.status IN ('pending', 'rejected') AND p.target_kind = 'relation'
       AND p.target_id = r.id) w ON true
  WHERE r.type = 'designated_by'`;

const main = async (): Promise<number> => {
  const write = argv.slice(2).includes('--write');
  const reader = new Pool({ connectionString: connectionString('app') });
  const writer = new Pool({ connectionString: connectionString('research') });
  try {
    const { rows } = await reader.query<Record<string, unknown>>(READ);
    const candidates = rows.map((row): Candidate => ({
      relationId: String(row['relation_id']),
      subjectType: String(row['subject_type']),
      waiting: row['waiting'] as Candidate['waiting'],
      collides: row['collides'] === true,
      originator: String(row['originator']),
      cites: row['cites'] as Cite[],
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
