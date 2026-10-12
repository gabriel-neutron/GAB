import { z } from 'zod';

import type { Sessions } from './pool.ts';
import { refused, runStatement, type DoorAct } from './statement.ts';

const READ =
  'SELECT imo, first_id, first_label, second_id, second_label FROM public.imo_duplicate_pairs()';

const pairRow = z.object({
  imo: z.string(),
  first_id: z.uuid(),
  first_label: z.string(),
  second_id: z.uuid(),
  second_label: z.string(),
});

/** One vessel of a pair: its identifier and its name. */
interface PairedVessel {
  readonly id: string;
  readonly label: string;
}

/** Two vessels of the record with one IMO number. */
interface ImoPair {
  readonly imo: string;
  readonly first: PairedVessel;
  readonly second: PairedVessel;
}

/** The pairs of vessels of the record with one IMO number, in the order of the number. */
export const readImoPairs = async (
  pool: Sessions,
): Promise<DoorAct<{ readonly pairs: readonly ImoPair[] }>> => {
  const answer = await runStatement(pool, READ, []);
  if (answer.outcome !== 'answered') return answer;
  const rows = z.array(pairRow).safeParse(answer.rows);
  if (!rows.success) return refused('the record gave pairs that this writer cannot read');
  return {
    outcome: 'done',
    reply: {
      pairs: rows.data.map((row) => ({
        imo: row.imo,
        first: { id: row.first_id, label: row.first_label },
        second: { id: row.second_id, label: row.second_label },
      })),
    },
  };
};
