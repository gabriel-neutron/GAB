import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { why } from './review-decision.ts';
import { defineTool } from './tool.ts';

const JOIN = 'SELECT public.ai_join_unit($1::uuid, $2::uuid, $3::text) AS said';

const row = z.object({
  said: z.object({
    name: z.string(),
    doubted: z.uuid(),
    waiting: z.uuid(),
    documents: z.number().int(),
    passages: z.number().int(),
  }),
});

export const joinUnit = defineTool({
  name: 'join_unit',
  description:
    'Joins a doubted unit of the review queue to a unit that waits for a better source. Use it ' +
    'when a second source states the same event, at the same site on the same day, and the ' +
    'propose tool made a new unit of it. The waiting unit takes the documents and the passages ' +
    'of the doubted unit, and the doubted unit is closed as a duplicate, with a note that names ' +
    'the waiting unit. The waiting unit stays in the queue for its reviewer. The database ' +
    'refuses a pair that is for another kind of event, another site or another day, a unit ' +
    'that is not in its state (doubted, waiting), a doubted unit that holds more than one act, ' +
    'two units with different modalities, and a waiting unit that cites each of the documents ' +
    'already. A second call on the same pair is refused. The record keeps the origin "decided ' +
    'by an AI reviewer" and your reason. Read the cited passage of both units first, and never ' +
    'decide a unit that you proposed: a new reviewer agent decides it.',
  input: z.strictObject({
    unitId: z.uuid().describe('the id of the doubted unit, from read_doubts'),
    waitingId: z.uuid().describe('the id of the unit that waits, from read_waiting'),
    why,
  }),
  output: z.strictObject({
    name: z.string(),
    doubted: z.uuid(),
    waiting: z.uuid(),
    documents: z.number().int(),
    passages: z.number().int(),
    origin: z.literal('decided by an AI reviewer'),
  }),
  run: async (session, input) => {
    const [held] = await rowsOf(session, row, JOIN, [input.unitId, input.waitingId, input.why]);
    if (held === undefined) throw new Error('the join returned no row');
    return { ...held.said, origin: 'decided by an AI reviewer' as const };
  },
});
