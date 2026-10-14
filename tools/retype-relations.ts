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
import { namesProvision } from '@gab/tools/stated-value';
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
  /** The label of the act at the far end of the relation, or an empty text. */
  readonly destination: string;
  readonly cites: readonly Cite[];
}

export type Decision =
  | { readonly kind: 'retype'; readonly batch: BatchName; readonly reason: string }
  | { readonly kind: 'keep'; readonly batch?: undefined; readonly reason: string }
  | { readonly kind: 'doubtful'; readonly batch?: undefined; readonly reason: string };

const RETYPE_ANNEXES = new Set(['III', 'XIV', 'XLIV', 'XLV', 'XLVII']);
const doubt = (reason: string): Decision => ({ kind: 'doubtful', reason });

const ASSET_FREEZE = /\bSDN\b|blocked property|asset freeze|269\/2014/i;

const US_DIRECTIVE = /\bdirective\s+\d+/i;

// The articles of 833/2014 that state a sectoral measure: 5af, and the articles of Annexes XLIV
// (5ac), III (5(a)), XLVII (5ae) and XIV (5h).
const SECTORAL_ARTICLE = /\barticle\s+5(?:af|ac|ae|h|\(a\))(?!\w)/gi;

// The title of Annex XLVII, "List of ports ... referred to in Article 5ae", does not say "Annex".
const PORT_ARTICLE = /\barticle\s+5ae\b/i;

/** The act at the far end names an OFAC directive under EO 13662 or EO 14024. */
const US_DIRECTIVE_ACT = /\bdirective\s+\d+\b.*\b(13662|14024)\b/i;

/** The first passage of a page that names the directive of the act, as the page spells it. */
export const directivePassage = (pageText: string | null, act: string): string | null => {
  const number = /\bdirective\s+(\d+)/i.exec(act)?.[1];
  if (number === undefined) return null;
  const found = new RegExp(
    `\\bdirective\\s+${number}\\b(?:(?!\\.\\s+[A-Z])[^\\n]){0,100}`,
    'i',
  ).exec(pageText ?? '');
  return found?.[0].trimEnd() ?? null;
};

/** The decision on the joined excerpts of one relation and the joined text of their pages. */
const classifyText = (
  text: string,
  pageText: string,
  subjectType: string,
  destination: string,
): Decision => {
  const annexes = [...text.matchAll(/\bannex\s+([ivxlc]+)\b/gi)].map((m) =>
    (m[1] ?? '').toUpperCase(),
  );
  // The text without the sectoral articles, to find another article.
  const otherArticles = text.replace(SECTORAL_ARTICLE, '');
  const article = otherArticles !== text;
  const sectoral = article || US_DIRECTIVE.test(text) || annexes.some((a) => RETYPE_ANNEXES.has(a));

  // The joined excerpts can name a listing that stays and a sectoral provision. That is a doubt.
  if (annexes.includes('XLII'))
    return sectoral
      ? doubt('a vessel list and a sectoral provision')
      : { kind: 'keep', reason: 'a vessel of Annex XLII' };
  if (ASSET_FREEZE.test(text))
    return sectoral
      ? doubt('an asset freeze and a sectoral provision')
      : { kind: 'keep', reason: 'a listing with an asset freeze' };

  // An excerpt that is only a line of the list names no provision. The act at the far end then
  // states the directive, and the page must name a directive to cite beside the excerpt.
  const bare =
    !US_DIRECTIVE.test(text) && !/\b(annex|articles?)\s+\w*\d|\bannex\s+[ivxlc]+/i.test(text);
  const byAct =
    bare &&
    subjectType !== 'person' &&
    US_DIRECTIVE_ACT.test(destination) &&
    directivePassage(pageText, destination) !== null;
  const us = (US_DIRECTIVE.test(text) && /\b(13662|14024)\b/.test(text)) || byAct;
  const eu = article || annexes.some((a) => RETYPE_ANNEXES.has(a));

  // A vessel is on the vessel list of a regime (SDN, Annex XLII, UK specified ship), and that
  // listing stays designated_by (#505). A provision in the excerpt other than the vessel list
  // (Article 3s, Annex XXV) is a doubt.
  if (subjectType === 'vessel')
    return us || eu || US_DIRECTIVE.test(text) || annexes.some((a) => a !== 'XXV')
      ? doubt('a vessel under a sectoral provision')
      : { kind: 'keep', reason: 'a vessel on the vessel list of a regime' };

  const unknown =
    annexes.some((a) => !RETYPE_ANNEXES.has(a)) ||
    /\barticles?\s+\d+/i.test(otherArticles) ||
    (!us && US_DIRECTIVE.test(text));

  if (unknown) return doubt('unknown provision');
  if (!us && !eu)
    return doubt(
      subjectType === 'person'
        ? 'a person with no provision in the excerpt'
        : 'no provision in the excerpt',
    );
  // Only 833/2014 has an Article 5ae. An amending act (2025/395) cites it for a port without the
  // number of the regulation.
  const portArticle = subjectType === 'port' && PORT_ARTICLE.test(text);
  if (eu && !portArticle && !text.includes('833/2014'))
    return doubt('an EU provision without 833/2014 in the excerpt');
  if (us && eu) return doubt('the excerpt names the provisions of two regimes');
  if (us) return { kind: 'retype', batch: 'us', reason: 'an OFAC directive' };
  if ((annexes.includes('XLVII') || PORT_ARTICLE.test(text)) && subjectType === 'port')
    return { kind: 'retype', batch: 'ports', reason: 'a port of Annex XLVII' };
  return { kind: 'retype', batch: 'eu', reason: 'a sectoral provision of 833/2014' };
};

/**
 * The decision on one relation. A unit usually cites the name of the party and the provision in
 * two excerpts, so the excerpts of the relation are read together and not one by one.
 */
export const classify = (one: Candidate): Decision => {
  if (one.waiting === 'rejected') return doubt('a retype act of the relation was rejected');
  if (one.waiting !== 'none') return doubt('the relation has a waiting act');
  if (one.collides) return doubt('another open relation links the same ends');
  if (one.cites.length === 0) return doubt('no usable citation');
  if (one.cites.some((c) => c.pageText === null || findExcerpt(c.pageText, c.excerpt) === null))
    return doubt('the stored text no longer holds the excerpt');
  return classifyText(
    one.cites.map((c) => c.excerpt).join('\n'),
    one.cites.map((c) => c.pageText).join('\n'),
    one.subjectType,
    one.destination,
  );
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

// The propose tool needs an excerpt that names the provision. When no excerpt of the relation
// does, the directive that the page names goes beside the excerpts.
const evidenceOf = (cites: readonly Cite[], act: string): Item['evidence'] => {
  const evidence = cites.map(({ document, page, excerpt }) => ({ document, page, excerpt }));
  if (namesProvision(evidence.map(({ excerpt }) => excerpt))) return evidence;
  for (const { document, page, pageText } of cites) {
    const excerpt = directivePassage(pageText, act);
    if (excerpt !== null) return [...evidence, { document, page, excerpt }];
  }
  return evidence;
};

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
          evidence: evidenceOf(one.cites, one.destination),
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
    coalesce(d.label, '') AS destination,
    EXISTS (SELECT 1 FROM public.relations x
             WHERE x.id <> r.id AND x.type IN ('designated_by', 'restricted_by')
               AND x.valid_to IS NULL
               AND x.src_kind = r.src_kind AND x.src_id = r.src_id
               AND x.dst_kind = r.dst_kind AND x.dst_id = r.dst_id) AS collides,
    coalesce(cs.cites, '[]'::json) AS cites
  FROM public.relations r
  JOIN public.entities e ON e.id = r.src_id AND r.src_kind = 'entity'
  LEFT JOIN public.entities d ON d.id = r.dst_id AND r.dst_kind = 'entity'
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
      destination: String(row['destination']),
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
