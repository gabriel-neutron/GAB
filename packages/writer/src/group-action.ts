import { groupActionRequest } from '@gab/proposal/request';
import { z } from 'zod';

import { readBody } from './body.ts';
import { DECIDED_BY } from './decision.ts';
import type { Sessions } from './pool.ts';
import { refused, runStatement, type DoorAct } from './statement.ts';

const PROMOTE = 'SELECT public.promote_group($1::uuid, $2::uuid[], $3::text) AS results';

const answered = z.object({
  results: z.array(
    z.object({
      unit: z.uuid(),
      name: z.string(),
      outcome: z.enum(['promoted', 'refused']),
      said: z.string().nullable(),
    }),
  ),
});

type GroupResults = z.output<typeof answered>;

/** Promote the clean units of one group that the screen showed. Each unit is promoted or refused
 * on its own, and the reply gives one result for each unit. A doubt is the action whose answer
 * never came back: some units may stand in the record. */
export const promoteGroup = async (pool: Sessions, raw: string): Promise<DoorAct<GroupResults>> => {
  const given = readBody(
    raw,
    groupActionRequest,
    'the body names one group and the units of it that the screen showed',
  );
  if (given.outcome !== 'read') return given;
  const answer = await runStatement(pool, PROMOTE, [
    given.body.groupId,
    given.body.unitIds,
    DECIDED_BY,
  ]);
  if (answer.outcome !== 'answered') return answer;
  const held = answered.safeParse(answer.rows[0]);
  if (!held.success)
    return refused('the record gave a result of the group action that this writer cannot read');
  return { outcome: 'done', reply: held.data };
};
