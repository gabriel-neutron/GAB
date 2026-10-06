import { decisionRequest, type DecisionOp } from '@gab/proposal/request';
import { z } from 'zod';

import { DECIDED_BY } from './decision.ts';
import type { Sessions } from './pool.ts';
import { refused, runStatement, type Unwritten } from './statement.ts';

/** What one decision became. A refusal wrote nothing. A doubt is the decision whose answer never
 * came back: it may stand in the record. */
export type DecidedAct =
  | {
      readonly outcome: 'decided';
      readonly reply: {
        readonly proposalId: string;
        /** The row the promotion wrote. A rejection writes none, and it answers `null`. */
        readonly targetId: string | null;
        readonly state: 'decided';
      };
    }
  | Unwritten;

const STATEMENT: Readonly<Record<DecisionOp, string>> = {
  promote_proposal: 'SELECT public.promote_proposal($1::uuid, $2::text) AS id',
  reject_proposal: 'SELECT public.reject_proposal($1::uuid, $2::text)',
};

const identifier = z.uuid();

// A promotion answers with the row it wrote. A rejection writes no row and answers nothing, so
// the reply carries `null` and the caller reads one shape for both acts.
const targetOf = (op: DecisionOp, row: Readonly<Record<string, unknown>> | undefined) =>
  op === 'reject_proposal' ? null : identifier.parse(row?.['id']);

/** Decide one act that waits. It raises nothing, and every failure arrives as a sentence. */
export const decide = async (pool: Sessions, op: DecisionOp, raw: string): Promise<DecidedAct> => {
  let given: unknown;
  try {
    given = JSON.parse(raw);
  } catch {
    return refused('the body is not a JSON object');
  }

  const request = decisionRequest.safeParse(given);
  if (!request.success) return refused('the body names no act');

  const { proposalId } = request.data;
  const answer = await runStatement(pool, STATEMENT[op], [proposalId, DECIDED_BY]);
  if (answer.outcome !== 'answered') return answer;
  return {
    outcome: 'decided',
    reply: { proposalId, targetId: targetOf(op, answer.row), state: 'decided' },
  };
};
