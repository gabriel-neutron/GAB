import { z } from 'zod';

import type { CheckVerdict } from './tool.ts';

// Departure: three exports, one job. The shape of the answer of a checker, the read of it into one
// verdict for each item, and the plain text of its reason are one contract.

/** The text with each control character changed to a space, and no run of spaces. The reason of
 * a checker can echo the page, and PostgreSQL refuses a NUL in a text. */
export const plainText = (text: string): string =>
  text.replace(/\p{Cc}+/gu, ' ').replace(/ {2,}/gu, ' ');

/** The answer of a checker: one verdict for each item. Only `supported` lets an item stand
 * undisputed. */
export const checkAnswer = z.strictObject({
  verdicts: z.array(
    z.strictObject({
      ref: z.string(),
      verdict: z.enum(['supported', 'not_supported', 'unclear']),
      // A model can give `null` for no reason, and that is not a fault of the answer.
      reason: z.string().nullish(),
    }),
  ),
});

/** The verdict on each item that the checker answered. A second verdict on one item makes it
 * unclear, and an item with no verdict is absent. */
export const verdictsOf = (
  refs: readonly string[],
  answer: z.output<typeof checkAnswer>,
): (readonly [string, CheckVerdict])[] =>
  refs.flatMap((ref): (readonly [string, CheckVerdict])[] => {
    const said = answer.verdicts.filter((one) => one.ref === ref);
    const [only] = said;
    if (only === undefined) return [];
    if (said.length > 1)
      return [[ref, { verdict: 'unclear', reason: 'the checker gave more than one verdict' }]];
    if (only.verdict === 'supported') return [[ref, { verdict: 'supported' }]];
    return [[ref, { verdict: only.verdict, reason: plainText(only.reason ?? '') }]];
  });
