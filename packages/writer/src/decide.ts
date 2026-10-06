import { batchDecisionRequest, decisionRequest, type DecisionOp } from '@gab/proposal/request';
import { z } from 'zod';

import { readBody } from './body.ts';
import { DECIDED_BY } from './decision.ts';
import type { Sessions } from './pool.ts';
import { runStatement, type DoorAct } from './statement.ts';

// Departure: two exports, one job. A decision on one act and a decision on a linked batch read
// one body, run one door and answer one shape.

const STATEMENT: Readonly<Record<DecisionOp, string>> = {
  promote_proposal: 'SELECT public.promote_proposal($1::uuid, $2::text) AS id',
  reject_proposal: 'SELECT public.reject_proposal($1::uuid, $2::text)',
};

const BATCH = 'SELECT public.decide_batch($1::uuid, $2::text, $3::text) AS decided';

const identifier = z.uuid();

// A promotion answers with the row it wrote. A rejection writes no row and answers nothing, so
// the reply carries `null` and the caller reads one shape for both acts.
const targetOf = (op: DecisionOp, row: Readonly<Record<string, unknown>> | undefined) =>
  op === 'reject_proposal' ? null : identifier.parse(row?.['id']);

interface Decided {
  readonly proposalId: string;
  /** The row the promotion wrote. A rejection writes none, and it answers `null`. */
  readonly targetId: string | null;
  readonly state: 'decided';
}

/** Decide one act that waits. A refusal wrote nothing. A doubt is the decision whose answer never
 * came back: it may stand in the record. It raises nothing. */
export const decide = async (
  pool: Sessions,
  op: DecisionOp,
  raw: string,
): Promise<DoorAct<Decided>> => {
  const given = readBody(raw, decisionRequest, 'the body names no act');
  if (given.outcome !== 'read') return given;

  const { proposalId } = given.body;
  const answer = await runStatement(pool, STATEMENT[op], [proposalId, DECIDED_BY]);
  if (answer.outcome !== 'answered') return answer;
  return {
    outcome: 'done',
    reply: { proposalId, targetId: targetOf(op, answer.rows[0]), state: 'decided' },
  };
};

/** Promote or reject every act that waits in one linked batch, in one transaction. A refusal
 * names the act that the record refused, and nothing of the batch was written. */
export const decideBatch = async (
  pool: Sessions,
  raw: string,
): Promise<DoorAct<{ readonly batchId: string; readonly state: 'decided' }>> => {
  const given = readBody(raw, batchDecisionRequest, 'the body names no batch and no verdict');
  if (given.outcome !== 'read') return given;

  const { batchId, verdict } = given.body;
  const answer = await runStatement(pool, BATCH, [batchId, verdict, DECIDED_BY]);
  if (answer.outcome !== 'answered') return answer;
  return { outcome: 'done', reply: { batchId, state: 'decided' } };
};
