import { z } from 'zod';

import type { Session, Sessions } from './pool.ts';

// Origin: decided, not calibrated. The review queue holds some hundred acts, and one read takes
// the passages of each one.
const MOST_ACTS = 1000;

const asked = z.strictObject({ proposalIds: z.array(z.uuid()).max(MOST_ACTS) });

// substr counts characters of the database encoding, which is UTF-8: code points, as the offsets.
const PASSAGES = `SELECT c.claim_id::text AS "proposalId", c.doc_id::text AS document,
    d.title, c.page, substr(t.text, c.start + 1, c."end" - c.start) AS text
  FROM public.citation c
  JOIN public.documents d ON d.id = c.doc_id
  JOIN public.document_text t
    ON t.document_id = c.doc_id AND t.extractor = c.text_extractor AND t.page = c.page
  WHERE c.claim_id = ANY ($1::uuid[])
  ORDER BY c.claim_id, c.doc_id, c.page, c.start`;

const passage = z.object({
  proposalId: z.string(),
  document: z.string(),
  title: z.string(),
  page: z.number().int(),
  text: z.string(),
});

/** What one read of the passages became. */
export type PassagesRead =
  | { readonly status: 200; readonly reply: { readonly passages: readonly unknown[] } }
  | { readonly status: 422 | 503; readonly reply: { readonly refusal: string } };

const UNAVAILABLE = 'the record did not answer, and the passages are not read';

/** The passages that the citations of the named acts point at, read as the operator. The text of
 * a document is private, so this read never goes through the public read API. */
export const readPassages = async (pool: Sessions, raw: string): Promise<PassagesRead> => {
  let given: unknown;
  try {
    given = JSON.parse(raw);
  } catch {
    return { status: 422, reply: { refusal: 'the body is not a JSON object' } };
  }
  const request = asked.safeParse(given);
  if (!request.success)
    return { status: 422, reply: { refusal: 'the body names the acts as a list of ids' } };

  let client: Session;
  try {
    client = await pool.connect();
  } catch {
    return { status: 503, reply: { refusal: UNAVAILABLE } };
  }
  try {
    const { rows } = await client.query(PASSAGES, [request.data.proposalIds]);
    return { status: 200, reply: { passages: rows.map((row) => passage.parse(row)) } };
  } catch {
    return { status: 503, reply: { refusal: UNAVAILABLE } };
  } finally {
    client.release();
  }
};
