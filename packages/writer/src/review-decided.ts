import { z } from 'zod';

import type { Sessions } from './pool.ts';
import { refused, runStatement, type DoorAct } from './statement.ts';

const READ = 'SELECT public.review_decided() AS read';

const readRow = z.object({ read: z.object({ acts: z.array(z.unknown()) }) });

/** The acts that the operator decided, the promoted and the rejected ones, read as the operator.
 * A rejection comes with its reason and its note, which are private, so the read never goes
 * through the public read API. */
export const readReviewDecided = async (
  pool: Sessions,
): Promise<DoorAct<z.output<typeof readRow>['read']>> => {
  const answer = await runStatement(pool, READ, []);
  if (answer.outcome !== 'answered') return answer;
  const held = readRow.safeParse(answer.rows[0]);
  return held.success
    ? { outcome: 'done', reply: held.data.read }
    : refused('the record gave a read of the decided acts that this writer cannot read');
};
