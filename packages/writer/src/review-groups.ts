import { z } from 'zod';

import { readBody } from './body.ts';
import type { Sessions } from './pool.ts';
import { refused, runStatement, type DoorAct } from './statement.ts';

// Departure: two exports, one job. The rail lists the groups, and the read of one group gives the
// units that the confirmation of the group action shows. Both read the faults, which are private.

const RAIL = 'SELECT public.review_groups() AS rail';
const GROUP = 'SELECT public.review_group($1::uuid) AS read';

const railRow = z.object({ rail: z.object({ groups: z.array(z.unknown()) }) });
const groupRow = z.object({
  read: z.object({ id: z.uuid(), subject: z.string().nullable(), units: z.array(z.unknown()) }),
});

const asked = z.strictObject({ groupId: z.uuid() });

const UNREAD = 'the record gave a read of the groups that this writer cannot read';

/** The rail of the groups that hold a unit that waits, read as the operator. */
export const readReviewGroups = async (
  pool: Sessions,
): Promise<DoorAct<z.output<typeof railRow>['rail']>> => {
  const answer = await runStatement(pool, RAIL, []);
  if (answer.outcome !== 'answered') return answer;
  const held = railRow.safeParse(answer.rows[0]);
  return held.success ? { outcome: 'done', reply: held.data.rail } : refused(UNREAD);
};

/** The units of one group that wait, with their state and their parent, read as the operator. */
export const readReviewGroup = async (
  pool: Sessions,
  raw: string,
): Promise<DoorAct<z.output<typeof groupRow>['read']>> => {
  const given = readBody(raw, asked, 'the body names one group');
  if (given.outcome !== 'read') return given;
  const answer = await runStatement(pool, GROUP, [given.body.groupId]);
  if (answer.outcome !== 'answered') return answer;
  const held = groupRow.safeParse(answer.rows[0]);
  return held.success ? { outcome: 'done', reply: held.data.read } : refused(UNREAD);
};
