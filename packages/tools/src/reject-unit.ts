import { z } from 'zod';

import { decide, decisionOutput, rejection, why } from './review-decision.ts';
import { defineTool } from './tool.ts';

const REJECT = 'SELECT public.ai_reject_unit($1::uuid, $2::text, $3::text, $4::text) AS said';

export const rejectUnit = defineTool({
  name: 'reject_unit',
  description:
    'Rejects one unit of the review queue, as the button "Reject" of the review page: every act ' +
    'of the unit that waits is rejected with one reason and one note. The record keeps the ' +
    'origin "decided by an AI reviewer" and your reason. Read the cited passage first, and never ' +
    'decide a unit that your own session proposed.',
  input: z.strictObject({
    unitId: z.uuid().describe('the id of the unit, from a list'),
    ...rejection,
    why,
  }),
  output: decisionOutput,
  run: (session, input) =>
    decide(session, REJECT, [input.unitId, input.reason, input.note ?? null, input.why]),
});
