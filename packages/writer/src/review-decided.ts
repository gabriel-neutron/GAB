import { z } from 'zod';

import { readBody } from './body.ts';
import type { Sessions } from './pool.ts';
import { refused, runStatement, type DoorAct } from './statement.ts';

const READ = 'SELECT public.review_decided($1::timestamptz, $2::uuid, $3::int) AS read';

// Origin: decided, not calibrated. The database reads no more than 500 acts in one page.
const MOST_ACTS = 500;

const key = z.strictObject({ decidedAt: z.iso.datetime({ offset: true }), id: z.uuid() });

/** The key of the last act of the page before, as the page gave it, or null, and the page size. */
const asked = z.strictObject({
  after: key.nullable(),
  size: z.number().int().min(1).max(MOST_ACTS),
});

const readRow = z.object({
  read: z.object({ acts: z.array(z.unknown()), next: key.nullable() }),
});

/** One page of the acts that the operator decided, the promoted and the rejected ones, read as
 * the operator. A rejection comes with its reason and its note, which are private, so the read
 * never goes through the public read API. */
export const readReviewDecided = async (
  pool: Sessions,
  raw: string,
): Promise<DoorAct<z.output<typeof readRow>['read']>> => {
  const given = readBody(
    raw,
    asked,
    `the body names the key of the last act read, or null, and a size of 1 to ${String(MOST_ACTS)}`,
  );
  if (given.outcome !== 'read') return given;
  const { after, size } = given.body;
  const answer = await runStatement(pool, READ, [
    after?.decidedAt ?? null,
    after?.id ?? null,
    size,
  ]);
  if (answer.outcome !== 'answered') return answer;
  const held = readRow.safeParse(answer.rows[0]);
  return held.success
    ? { outcome: 'done', reply: held.data.read }
    : refused('the record gave a read of the decided acts that this writer cannot read');
};
