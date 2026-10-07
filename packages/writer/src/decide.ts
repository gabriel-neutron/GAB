import { decisionRequest, type DecisionOp } from '@gab/proposal/request';
import { z } from 'zod';

import { readBody } from './body.ts';
import { DECIDED_BY } from './decision.ts';
import type { Sessions } from './pool.ts';
import { runStatement, type DoorAct } from './statement.ts';

interface Door {
  readonly statement: string;
  /** The body, read into the values of the statement in the order the statement takes them. */
  readonly values: z.ZodType<readonly unknown[]>;
  readonly unread: string;
}

const DOORS: Readonly<Record<DecisionOp, Door>> = {
  promote_unit: {
    statement: 'SELECT public.promote_unit($1::uuid, $2::text) AS id',
    values: decisionRequest.promote_unit.transform((body) => [body.unitId, DECIDED_BY]),
    unread: 'the body names no unit',
  },
  reject_unit: {
    statement: 'SELECT public.reject_unit($1::uuid, $2::text, $3::text, $4::text)',
    values: decisionRequest.reject_unit.transform((body) => [
      body.unitId,
      body.reason,
      body.note ?? null,
      DECIDED_BY,
    ]),
    unread: 'the body names no unit and no reason',
  },
  reject_relation: {
    statement: 'SELECT public.reject_relation($1::uuid, $2::text, $3::text, $4::text)',
    values: decisionRequest.reject_relation.transform((body) => [
      body.proposalId,
      body.reason,
      body.note ?? null,
      DECIDED_BY,
    ]),
    unread: 'the body names no relation and no reason',
  },
};

const identifier = z.uuid();

interface Decided {
  /** The row that the promotion wrote for the head of the unit. A rejection writes none, and it
   * answers `null`. */
  readonly targetId: string | null;
  readonly state: 'decided';
}

/** Decide one unit, or reject one relation of it. A promotion writes the whole unit or nothing,
 * and a refusal names the act that the record refused. A doubt is the decision whose answer never
 * came back: it may stand in the record. It raises nothing. */
export const decide = async (
  pool: Sessions,
  op: DecisionOp,
  raw: string,
): Promise<DoorAct<Decided>> => {
  const door = DOORS[op];
  const given = readBody(raw, door.values, door.unread);
  if (given.outcome !== 'read') return given;

  const answer = await runStatement(pool, door.statement, given.body);
  if (answer.outcome !== 'answered') return answer;
  const targetId = op === 'promote_unit' ? identifier.parse(answer.rows[0]?.['id']) : null;
  return { outcome: 'done', reply: { targetId, state: 'decided' } };
};
