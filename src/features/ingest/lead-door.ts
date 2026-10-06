// Departure: two exports, one job. The operator starts a lead and reads the leads, and both
// answers come from the writer with one set of outcomes.

import { z } from 'zod';

/** One lead as the writer answers it, with the documents that it stored. */
export interface Lead {
  readonly id: string;
  readonly lead: string;
  readonly status: 'queued' | 'running' | 'done' | 'failed';
  readonly reason: string | null;
  readonly documents: readonly { readonly id: string; readonly title: string }[];
}

interface Refused {
  readonly state: 'refused';
  readonly refusal: string;
}

// The development server proxies these paths to the writer, so the browser stays same-origin.
const START_DOOR = '/write/start-lead';
const READ_DOOR = '/private/leads';

const NO_ANSWER = 'the write service did not answer. Read the leads again';

const started = z.object({ jobId: z.string() });
const refused = z.object({ refusal: z.string() });
const leads = z.object({
  leads: z.array(
    z.object({
      id: z.string(),
      lead: z.string(),
      status: z.enum(['queued', 'running', 'done', 'failed']),
      reason: z.string().nullable(),
      documents: z.array(z.object({ id: z.string(), title: z.string() })),
    }),
  ),
});

const knock = async (address: string, body: unknown): Promise<unknown> => {
  try {
    const answer = await fetch(address, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return await answer.json();
  } catch {
    return undefined;
  }
};

const refusalOf = (body: unknown): Refused => {
  const sentence = refused.safeParse(body);
  return { state: 'refused', refusal: sentence.success ? sentence.data.refusal : NO_ANSWER };
};

/** Give a lead to the worker. It searches and stores the sources, and proposes nothing. */
export async function startLead(lead: string): Promise<{ readonly state: 'started' } | Refused> {
  const body = await knock(START_DOOR, { lead });
  return started.safeParse(body).success ? { state: 'started' } : refusalOf(body);
}

/** Read the leads, the newest first. */
export async function readLeads(): Promise<
  { readonly state: 'read'; readonly leads: readonly Lead[] } | Refused
> {
  const body = await knock(READ_DOOR, {});
  const held = leads.safeParse(body);
  return held.success ? { state: 'read', leads: held.data.leads } : refusalOf(body);
}
