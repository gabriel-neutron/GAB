import { z } from 'zod';

import { readBody } from './body.ts';
import type { Sessions } from './pool.ts';
import { runStatement, type DoorAct } from './statement.ts';

// Origin: decided, not calibrated. One read takes the passages of at most this many acts, and the
// browser asks for a longer queue in parts.
const MOST_ACTS = 1000;

const asked = z.strictObject({ proposalIds: z.array(z.uuid()).max(MOST_ACTS) });

// substr counts characters of the database encoding, which is UTF-8: code points, as the offsets.
// The reason of a dispute is private for the same reason as the passage it judges. One statement
// reads both, so the two lists come from one view of the record.
const PASSAGES = `SELECT
  (SELECT coalesce(jsonb_agg(jsonb_build_object(
            'proposalId', c.claim_id::text, 'document', c.doc_id::text, 'title', d.title,
            'mime', d.mime, 'page', c.page, 'text', substr(t.text, c.start + 1, c."end" - c.start))
          ORDER BY c.claim_id, c.doc_id, c.page, c.start), '[]'::jsonb)
     FROM public.citation c
     JOIN public.documents d ON d.id = c.doc_id
     JOIN public.document_text t
       ON t.document_id = c.doc_id AND t.extractor = c.text_extractor AND t.page = c.page
    WHERE c.claim_id = ANY ($1::uuid[])) AS passages,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('proposalId', p.id::text,
                                                'reason', p.dissent_reason)
          ORDER BY p.id), '[]'::jsonb)
     FROM public.proposals p
    WHERE p.id = ANY ($1::uuid[]) AND p.dissent_reason IS NOT NULL) AS disputes`;

const read = z.object({
  passages: z.array(
    z.object({
      proposalId: z.string(),
      document: z.string(),
      title: z.string(),
      mime: z.string().nullable(),
      page: z.number().int(),
      text: z.string(),
    }),
  ),
  disputes: z.array(z.object({ proposalId: z.string(), reason: z.string() })),
});

/** The passages that the citations of the named acts point at, and why each disputed act is
 * disputed, read as the operator. Both are private, so this read never goes through the public
 * read API. */
export const readPassages = async (
  pool: Sessions,
  raw: string,
): Promise<DoorAct<z.output<typeof read>>> => {
  const given = readBody(
    raw,
    asked,
    `the body names at most ${String(MOST_ACTS)} acts as a list of ids`,
  );
  if (given.outcome !== 'read') return given;
  const answer = await runStatement(pool, PASSAGES, [given.body.proposalIds]);
  if (answer.outcome !== 'answered') return answer;
  return { outcome: 'done', reply: read.parse(answer.rows[0]) };
};
