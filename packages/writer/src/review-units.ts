import { PROPOSERS } from '@gab/proposal/proposer';
import { z } from 'zod';

import { readBody } from './body.ts';
import type { Sessions } from './pool.ts';
import { refused, runStatement, type DoorAct } from './statement.ts';

const READ = `SELECT public.review_units($1::text[], $2::int, $3::uuid, $4::text, $5::text,
  $6::text, $7::text) AS page`;

// Origin: decided, not calibrated. A page holds the units that one screen of the left column
// shows, and the database reads no more than 200 in one page.
const MOST_UNITS = 200;

// Origin: decided. A name longer than any name of the record finds nothing.
const LONGEST_NAME = 200;

/** The filters of the queue. An absent filter keeps every unit. */
const filter = z.strictObject({
  group: z.uuid().optional(),
  proposer: z.enum(PROPOSERS).optional(),
  fault: z
    .string()
    .regex(/^[a-z_]{1,40}$/)
    .optional(),
  document: z.string().min(1).max(LONGEST_NAME).optional(),
  name: z.string().trim().min(1).max(LONGEST_NAME).optional(),
});

/** The sort key of the last unit of the page before, as the page gave it, the page size, and the
 * filters. */
const asked = z.strictObject({
  after: z.array(z.string()).length(8).nullable(),
  size: z.number().int().min(1).max(MOST_UNITS),
  filter: filter.optional(),
});

const pageRow = z.object({
  page: z.object({
    total: z.number().int(),
    matched: z.number().int(),
    before: z.number().int(),
    next: z.array(z.string()).nullable(),
    choices: z.unknown(),
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
    `the body names the key of the last unit read, or null, a size of 1 to ${String(MOST_UNITS)}, and the filters`,
  );
  if (given.outcome !== 'read') return given;
  const { after, size, filter: kept = {} } = given.body;
  const answer = await runStatement(pool, READ, [
    after,
    size,
    kept.group ?? null,
    kept.proposer ?? null,
    kept.fault ?? null,
    kept.document ?? null,
    kept.name ?? null,
  ]);
  if (answer.outcome !== 'answered') return answer;
  const held = pageRow.safeParse(answer.rows[0]);
  if (!held.success)
    return refused('the record gave a page of the queue that this writer cannot read');
  return { outcome: 'done', reply: held.data.page };
};
