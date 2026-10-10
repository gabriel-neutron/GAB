import { z } from 'zod';

import type { Queryable } from '../queryable.ts';

const pairRow = z.object({
  act: z.uuid(),
  letter: z.enum(['A', 'B', 'C', 'D', 'E', 'F']),
  digit: z.number().int().min(1).max(6),
});

/** The NATO pair of a claim: the letter of the best author that supports its fact, and the digit
 * of the fact. The database judges each one apart. */
export type NatoPair = Omit<z.output<typeof pairRow>, 'act'>;

/** The pair of each claim that has one, by the identifier of the claim. A claim with no digit, or
 * with no author letter, is not in the map. The database computes each pair from the act that the
 * claim names. */
export const readNatoPairs = async (
  db: Queryable,
  claims: readonly { readonly claim_id: string; readonly act_id: string }[],
): Promise<ReadonlyMap<string, NatoPair>> => {
  const acts = [...new Set(claims.map((one) => one.act_id))];
  const { rows } = await db.query(
    'SELECT act, letter, digit::int AS digit FROM public.nato_pair($1::uuid[])',
    [acts],
  );
  const byAct = new Map(
    z
      .array(pairRow)
      .parse(rows)
      .map(({ act, ...pair }) => [act, pair] as const),
  );
  return new Map(
    claims.flatMap((one) => {
      const pair = byAct.get(one.act_id);
      return pair === undefined ? [] : [[one.claim_id, pair] as const];
    }),
  );
};
