// Departure: two exports, one job. The operator starts a lead and reads the leads, and both
// answers come from the writer through the one door of the browser.

import { z } from 'zod';

import { askWriter } from '@/shared/write/door';
import type { WriteResult } from '@/shared/write/write-state';

const START_DOOR = '/write/start-lead';
const READ_DOOR = '/private/leads';

// The screen reads the leads again after a start, so the done step carries nothing.
const started = z.object({ jobId: z.string() }).transform(() => ({}));

const leadShape = z.object({
  id: z.string(),
  lead: z.string(),
  status: z.enum(['queued', 'running', 'done', 'failed']),
  reason: z.string().nullable(),
  documents: z.array(z.object({ id: z.string(), title: z.string() })),
});

/** One lead as the writer answers it, with the documents that it stored. */
export type Lead = z.output<typeof leadShape>;

const leads = z.object({ leads: z.array(leadShape) });

/** Give a lead to the worker. It searches and stores the sources, and proposes nothing. */
export const startLead = (lead: string): Promise<WriteResult> =>
  askWriter(START_DOOR, { lead }, started);

/** Read the leads, the newest first. */
export const readLeads = (): Promise<WriteResult<{ readonly leads: readonly Lead[] }>> =>
  askWriter(READ_DOOR, {}, leads);
