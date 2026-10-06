import { batchDecisionRequest } from '@gab/proposal/request';

import { DECIDED_BY } from './decision.ts';
import type { Sessions } from './pool.ts';
import { refused, runStatement, type Unwritten } from './statement.ts';

/** What one decision on a batch became. A refusal wrote nothing, and its sentence names the act
 * that the record refused. A doubt is the decision whose answer never came back. */
export type DecidedBatch =
  | {
      readonly outcome: 'decided';
      readonly reply: { readonly batchId: string; readonly state: 'decided' };
    }
  | Unwritten;

const STATEMENT = 'SELECT public.decide_batch($1::uuid, $2::text, $3::text) AS decided';

/** Promote or reject every act that waits in one linked batch, in one transaction. It raises
 * nothing, and every failure arrives as a sentence. */
export const decideBatch = async (pool: Sessions, raw: string): Promise<DecidedBatch> => {
  let given: unknown;
  try {
    given = JSON.parse(raw);
  } catch {
    return refused('the body is not a JSON object');
  }

  const request = batchDecisionRequest.safeParse(given);
  if (!request.success) return refused('the body names no batch and no verdict');

  const { batchId, verdict } = request.data;
  const answer = await runStatement(pool, STATEMENT, [batchId, verdict, DECIDED_BY]);
  if (answer.outcome !== 'answered') return answer;
  return { outcome: 'decided', reply: { batchId, state: 'decided' } };
};
