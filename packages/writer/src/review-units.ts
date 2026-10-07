import { z } from 'zod';

import { readBody } from './body.ts';
import type { Sessions } from './pool.ts';
import { refused, runStatement, type DoorAct } from './statement.ts';

const READ = 'SELECT public.review_units($1::text[], $2::int) AS page';

// Origin: decided, not calibrated. A page holds the units that one screen of the left column
// shows, and the database reads no more than 200 in one page.
const MOST_UNITS = 200;

/** The sort key of the last unit of the page before, as the page gave it, and the page size. */
const asked = z.strictObject({
  after: z.array(z.string()).length(5).nullable(),
  size: z.number().int().min(1).max(MOST_UNITS),
});

const pageRow = z.object({
  page: z.object({
    total: z.number().int(),
    next: z.array(z.string()).nullable(),
    units: z.array(z.unknown()),
  }),
});

/** One page of the review queue, read as the operator: the units with their acts, the cited
 * passages and the reason of each dispute. All of it is private, so the read never goes through
 * the public read API. */
export const readReviewUnits = async (
  pool: Sessions,
  raw: string,
): Promise<DoorAct<z.output<typeof pageRow>['page']>> => {
  const given = readBody(
    raw,
    asked,
    `the body names the key of the last unit read, or null, and a size of 1 to ${String(MOST_UNITS)}`,
  );
  if (given.outcome !== 'read') return given;
  const answer = await runStatement(pool, READ, [given.body.after, given.body.size]);
  if (answer.outcome !== 'answered') return answer;
  const held = pageRow.safeParse(answer.rows[0]);
  if (!held.success)
    return refused('the record gave a page of the queue that this writer cannot read');
  return { outcome: 'done', reply: held.data.page };
};
