import { z } from 'zod';

import type { Queryable } from './queryable.ts';

// The door takes the oldest queued row of a work kind and marks it running in one transaction of
// its own. The lock that keeps two claims off one row is inside it, because no role may write
// the table.
const CLAIM =
  'SELECT job_id, job_document, job_kind, job_lead, job_mapping, job_author, job_budget FROM public.claim_job()';

const claimed = z
  .array(
    z.union([
      z.object({
        job_id: z.uuid(),
        job_document: z.string().min(1),
        job_kind: z.enum(['extract_text', 'map_structured']),
        job_lead: z.null(),
        job_mapping: z.null(),
        job_author: z.null(),
        job_budget: z.null(),
      }),
      z.object({
        job_id: z.uuid(),
        job_document: z.string().min(1),
        job_kind: z.literal('load_mapped'),
        job_lead: z.null(),
        job_mapping: z.uuid(),
        job_author: z.null(),
        job_budget: z.null(),
      }),
      z.object({
        job_id: z.uuid(),
        job_document: z.null(),
        job_kind: z.literal('research_lead'),
        job_lead: z.string().min(1),
        job_mapping: z.null(),
        job_author: z.null(),
        job_budget: z.number().int().positive().nullable(),
      }),
      z.object({
        job_id: z.uuid(),
        job_document: z.null(),
        job_kind: z.literal('rate_author'),
        job_lead: z.null(),
        job_mapping: z.null(),
        job_author: z.string().min(1),
        job_budget: z.null(),
      }),
    ]),
  )
  .max(1);

/** One unit of work, held by this worker and already marked as running. A document job reads
 * one stored document, a lead holds a text and no document, and a rating holds a name. */
export type ClaimedJob =
  | {
      readonly id: string;
      readonly kind: 'extract_text' | 'map_structured';
      readonly documentId: string;
    }
  | {
      readonly id: string;
      readonly kind: 'load_mapped';
      readonly documentId: string;
      readonly mappingId: string;
    }
  | {
      readonly id: string;
      readonly kind: 'research_lead';
      readonly lead: string;
      /** The token budget that a rule gave to this deepening search. A lead of the operator has none. */
      readonly tokenBudget: number | null;
    }
  | { readonly id: string; readonly kind: 'rate_author'; readonly author: string };

/** Takes one job for this connection, or answers null when no queued job is free to take. The
 * taker is the role of the connection: the door reads it and takes no name. */
export const claimJob = async (on: Queryable): Promise<ClaimedJob | null> => {
  const found = claimed.parse((await on.query(CLAIM)).rows);
  const row = found[0];
  if (row === undefined) return null;
  if (row.job_kind === 'research_lead')
    return { id: row.job_id, kind: row.job_kind, lead: row.job_lead, tokenBudget: row.job_budget };
  if (row.job_kind === 'rate_author')
    return { id: row.job_id, kind: row.job_kind, author: row.job_author };
  if (row.job_kind === 'load_mapped')
    return {
      id: row.job_id,
      kind: row.job_kind,
      documentId: row.job_document,
      mappingId: row.job_mapping,
    };
  return { id: row.job_id, kind: row.job_kind, documentId: row.job_document };
};
