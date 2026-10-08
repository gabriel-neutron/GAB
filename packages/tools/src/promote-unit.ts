import { z } from 'zod';

import { decide, decisionOutput, why } from './review-decision.ts';
import { defineTool } from './tool.ts';

const PROMOTE = 'SELECT public.ai_promote_unit($1::uuid, $2::text) AS said';

export const promoteUnit = defineTool({
  name: 'promote_unit',
  description:
    'Promotes one unit of the review queue into the record, as the button "Promote" of the ' +
    'review page: the unit is written whole, or nothing. The record keeps the origin "decided by ' +
    'an AI reviewer" and your reason, so the operator sees that a human did not decide. The ' +
    'database runs the same check of the faults as the page, and refuses a unit with an ' +
    'impossible link or a unit that waits for another unit. Read the cited passage first, and ' +
    'never decide a unit that your own session proposed.',
  input: z.strictObject({ unitId: z.uuid().describe('the id of the unit, from a list'), why }),
  output: decisionOutput,
  run: (session, input) => decide(session, PROMOTE, [input.unitId, input.why]),
});
