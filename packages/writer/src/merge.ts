import { mergeRequest, type MergeOp } from '@gab/proposal/request';
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

const DOORS: Readonly<Record<MergeOp, Door>> = {
  merge_entities: {
    statement:
      'SELECT proposal_id, target_id FROM public.merge_entities($1::text, $2::uuid, $3::uuid)',
    values: mergeRequest.merge_entities.transform((body) => [
      DECIDED_BY,
      body.survivorId,
      body.absorbedId,
    ]),
    unread: 'the body names no survivor and no absorbed entity',
  },
  undo_merge: {
    statement: 'SELECT proposal_id, target_id FROM public.undo_merge($1::text, $2::uuid)',
    values: mergeRequest.undo_merge.transform((body) => [DECIDED_BY, body.absorbedId]),
    unread: 'the body names no absorbed entity',
  },
};

const signedRow = z.object({ proposal_id: z.uuid(), target_id: z.uuid() });

// The act stands, so an answer that this writer cannot read is a doubt, not a refusal.
const UNREAD = 'the record wrote the act and gave an answer that this writer cannot read';

/** Merge two entities, or undo a merge. The act and its promotion run in one transaction, so it
 * is written whole or not at all. The target of a merge is the survivor, and the target of an
 * undo is the absorbed entity that it restores. It raises nothing. */
export const merge = async (
  pool: Sessions,
  op: MergeOp,
  raw: string,
): Promise<
  DoorAct<{ readonly proposalId: string; readonly targetId: string; readonly state: 'signed' }>
> => {
  const door = DOORS[op];
  const given = readBody(raw, door.values, door.unread);
  if (given.outcome !== 'read') return given;

  const answer = await runStatement(pool, door.statement, given.body);
  if (answer.outcome !== 'answered') return answer;
  const row = signedRow.safeParse(answer.rows[0]);
  if (!row.success) return { outcome: 'doubt', reply: { doubt: UNREAD } };
  return {
    outcome: 'done',
    reply: { proposalId: row.data.proposal_id, targetId: row.data.target_id, state: 'signed' },
  };
};
