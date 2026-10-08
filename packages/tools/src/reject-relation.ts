import { z } from 'zod';

import { decide, decisionOutput, rejection, why } from './review-decision.ts';
import { defineTool } from './tool.ts';

const REJECT = 'SELECT public.ai_reject_relation($1::uuid, $2::text, $3::text, $4::text) AS said';

export const rejectRelation = defineTool({
  name: 'reject_relation',
  description:
    'Rejects one new relation of a unit, as the button "Reject the relation" of the review page. ' +
    'The rest of the unit stays in the queue. The record keeps the origin "decided by an AI ' +
    'reviewer" and your reason. Read the cited passage first, and never decide a unit that your ' +
    'own session proposed.',
  input: z.strictObject({
    relationId: z.uuid().describe('the id of the act of the relation, from the acts of a unit'),
    ...rejection,
    why,
  }),
  output: decisionOutput,
  run: (session, input) =>
    decide(session, REJECT, [input.relationId, input.reason, input.note ?? null, input.why]),
});
