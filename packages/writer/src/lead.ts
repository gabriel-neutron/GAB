import { z } from 'zod';

import { readBody } from './body.ts';
import type { Sessions } from './pool.ts';
import { runStatement, type DoorAct } from './statement.ts';

// Departure: two exports, one job. The operator starts a lead and reads what the leads stored.

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

/** One lead, as the operator reads it. `by` is the role that started it: the operator or the
 * research AI. A failed lead gives its reason. A deepening search that stopped at its token budget
 * is done, and it gives that reason. Any other lead has no reason. */
interface LeadJob {
  readonly id: string;
  readonly lead: string;
  readonly by: string;
  readonly status: z.output<typeof leadRow>['job_status'];
  readonly reason: string | null;
  readonly documents: z.output<typeof leadRow>['documents'];
}

/** Start a lead: the worker searches, fetches and stores the sources for its text, and queues
 * the extraction of each page that it stores. */
export const startLead = async (
  pool: Sessions,
  raw: string,
): Promise<DoorAct<{ readonly jobId: string }>> => {
  const given = readBody(raw, body, 'the body states no lead');
  if (given.outcome !== 'read') return given;
  const answer = await runStatement(pool, START, [given.body.lead]);
  if (answer.outcome !== 'answered') return answer;
  return { outcome: 'done', reply: { jobId: startedRow.parse(answer.rows[0]).id } };
};

/** The leads, the newest first, each with the documents that it stored. */
export const readLeads = async (
  pool: Sessions,
): Promise<DoorAct<{ readonly leads: readonly LeadJob[] }>> => {
  const answer = await runStatement(pool, READ, []);
  if (answer.outcome !== 'answered') return answer;
  return {
    outcome: 'done',
    reply: {
      leads: answer.rows.map((row) => {
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
    },
  };
};
