import { z } from 'zod';

import type { Sessions } from './pool.ts';
import { failureFrom, refusalFrom } from './refusal.ts';

// Departure: two exports, one job. The operator starts a lead and reads what the leads stored, and
// both answers share one set of outcomes.

const DONE = 200;
const REFUSED = 422;
const UNAVAILABLE = 503;

/** One document that a lead stored. */
export interface LeadDocument {
  readonly id: string;
  readonly title: string;
  readonly url: string | null;
}

/** One lead, as the operator reads it. A lead that did not fail has no reason. */
export interface LeadLine {
  readonly id: string;
  readonly lead: string;
  /** The role that started the lead: the operator or the research AI. */
  readonly by: string;
  readonly status: 'queued' | 'running' | 'done' | 'failed';
  readonly reason: string | null;
  readonly documents: readonly LeadDocument[];
}

export type LeadReply =
  | { readonly jobId: string }
  | { readonly leads: readonly LeadLine[] }
  | { readonly refusal: string };

export interface LeadAct {
  readonly status: typeof DONE | typeof REFUSED | typeof UNAVAILABLE;
  readonly reply: LeadReply;
}

const START = 'SELECT public.start_lead($1)::text AS id';
const READ = 'SELECT * FROM public.lead_jobs()';

const body = z.object({ lead: z.string() });
const startedRow = z.object({ id: z.uuid() });
const leadRow = z.object({
  job_id: z.uuid(),
  lead: z.string(),
  lead_by: z.string(),
  job_status: z.enum(['queued', 'running', 'done', 'failed']),
  job_reason: z.string().nullable(),
  documents: z.array(z.object({ id: z.string(), title: z.string(), url: z.string().nullable() })),
});

const NO_LEAD = 'the body states no lead';

// A lost answer of the start door may stand as a lead, so a new read of the leads is the safe
// next step.
const LOST = 'the database did not answer. Read the leads again before you start it again';

const leadOf = (raw: string): string | undefined => {
  try {
    const held = body.safeParse(JSON.parse(raw));
    return held.success ? held.data.lead : undefined;
  } catch {
    return undefined;
  }
};

const run = async (
  pool: Sessions,
  text: string,
  values: unknown[],
  work: (rows: Record<string, unknown>[]) => LeadReply,
): Promise<LeadAct> => {
  let session;
  try {
    session = await pool.connect();
  } catch (cause) {
    return { status: UNAVAILABLE, reply: { refusal: refusalFrom(cause) } };
  }
  try {
    const found = await session.query(text, values);
    return { status: DONE, reply: work(found.rows) };
  } catch (cause) {
    const failure = failureFrom(cause);
    return failure.raised
      ? { status: REFUSED, reply: { refusal: failure.refusal } }
      : { status: UNAVAILABLE, reply: { refusal: LOST } };
  } finally {
    session.release();
  }
};

/** Start a lead: the worker searches, fetches and stores the sources for its text, and queues
 * the extraction of each page that it stores. */
export const startLead = (pool: Sessions, raw: string): Promise<LeadAct> => {
  const lead = leadOf(raw);
  if (lead === undefined) return Promise.resolve({ status: REFUSED, reply: { refusal: NO_LEAD } });
  return run(pool, START, [lead], (rows) => ({ jobId: startedRow.parse(rows[0]).id }));
};

/** The leads, the newest first, each with the documents that it stored. */
export const readLeads = (pool: Sessions): Promise<LeadAct> =>
  run(pool, READ, [], (rows) => ({
    leads: rows.map((row) => {
      const held = leadRow.parse(row);
      return {
        id: held.job_id,
        lead: held.lead,
        by: held.lead_by,
        status: held.job_status,
        reason: held.job_reason,
        documents: held.documents,
      };
    }),
  }));
