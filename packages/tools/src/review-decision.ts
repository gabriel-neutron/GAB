import { z } from 'zod';

import { rowsOf } from './fields.ts';
import type { Session } from './tool.ts';

// Departure: four exports, one job. The three decisions of an AI reviewer share their fields and
// their answer.

/** The reason that the AI gives for its decision. The operator reads it beside the origin. */
export const why = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .describe(
    'why you decide so, in one or two sentences that name the cited passage; the operator reads it',
  );

/** The reason and the note of a rejection, as the review page takes them. The database holds the
 * list of reasons and the rule on the note, and it words its own refusal. */
export const rejection = {
  reason: z
    .string()
    .describe(
      'one of wrong_value, not_in_source, wrong_type, duplicate, out_of_scope, end_rejected ' +
        '(only for a relation whose other end was rejected), other (needs a note)',
    ),
  note: z.string().max(500).optional().describe('a note to the operator; required for "other"'),
};

/** What one decision took, with its origin. */
export const decisionOutput = z.strictObject({
  name: z.string(),
  entities: z.number().int(),
  relations: z.number().int(),
  others: z.number().int(),
  origin: z.literal('decided by an AI reviewer'),
});

const row = z.object({
  said: z.object({
    name: z.string(),
    entities: z.number().int(),
    relations: z.number().int(),
    others: z.number().int(),
  }),
});

/** Runs one door of an AI reviewer and gives what the decision took. */
export const decide = async (
  session: Session,
  statement: string,
  values: unknown[],
): Promise<z.output<typeof decisionOutput>> => {
  const [held] = await rowsOf(session, row, statement, values);
  if (held === undefined) throw new Error('the decision returned no row');
  return { ...held.said, origin: 'decided by an AI reviewer' };
};
