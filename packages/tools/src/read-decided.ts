import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

const READ = 'SELECT public.review_decided($1::timestamptz, $2::uuid, $3::int) AS read';

// Origin: decided, not calibrated. The database reads no more than 500 acts in one page.
const MOST_ACTS = 500;

const key = z.strictObject({ decidedAt: z.string(), id: z.uuid() });

const act = z.object({
  id: z.uuid(),
  op: z.string(),
  name: z.string().nullable(),
  proposer: z.string(),
  status: z.string(),
  decidedAt: z.string(),
  decidedAs: z.string().nullable(),
  decisionOrigin: z.string().nullable(),
  decisionReason: z.string().nullable(),
  rejectReason: z.string().nullable(),
  rejectNote: z.string().nullable(),
});

const row = z.object({ read: z.object({ acts: z.array(act), next: key.nullable() }) });

export const readDecided = defineTool({
  name: 'read_decided',
  description:
    'Reads one page of the list "Decided" of the review page: the decided acts, the latest ' +
    'first, each with its verdict, its origin (a rule with its version, "validated manually by ' +
    'the operator" or "decided by an AI reviewer"), the reason that an AI reviewer gave, and the ' +
    'reason and the note of a rejection. Give "next" of the page as "after" to read the next page.',
  input: z.strictObject({
    after: key.optional().describe('the value of "next" of the page before'),
    size: z.number().int().min(1).max(MOST_ACTS).default(50),
  }),
  output: z.strictObject({ acts: z.array(act), next: key.nullable() }),
  async run(session, input) {
    const [held] = await rowsOf(session, row, READ, [
      input.after?.decidedAt ?? null,
      input.after?.id ?? null,
      input.size,
    ]);
    if (held === undefined) throw new Error('the read of the decided acts returned no row');
    return held.read;
  },
});
