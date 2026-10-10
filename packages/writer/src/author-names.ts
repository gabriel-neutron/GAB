import { z } from 'zod';

import { readBody } from './body.ts';
import type { Sessions } from './pool.ts';
import { refused, runStatement, type DoorAct } from './statement.ts';

// Departure: two exports, one job. The operator reads the names that wait and decides each one.

const READ = 'SELECT name_key, author, letter, units FROM public.author_names_waiting()';
const DECIDE = 'SELECT public.decide_author_name($1, $2) AS units';

const decision = z.strictObject({ name: z.string(), confirm: z.boolean() });

const nameRow = z.object({
  name_key: z.string(),
  author: z.string(),
  letter: z.string(),
  units: z.number().int(),
});
const decidedRow = z.object({ units: z.number().int() });

/** One name that joined an author A or B, the author, the letter of that author, and the number
 * of units that the name holds in doubt until the operator decides it. */
interface WaitingName {
  readonly name: string;
  readonly author: string;
  readonly letter: string;
  readonly units: number;
}

/** The names that wait for the operator, the name with the most units first. */
export const readAuthorNames = async (
  pool: Sessions,
): Promise<DoorAct<{ readonly names: readonly WaitingName[] }>> => {
  const answer = await runStatement(pool, READ, []);
  if (answer.outcome !== 'answered') return answer;
  const names = z.array(nameRow).safeParse(answer.rows);
  if (!names.success) return refused('the record gave names that this writer cannot read');
  return {
    outcome: 'done',
    reply: {
      names: names.data.map((row) => ({
        name: row.name_key,
        author: row.author,
        letter: row.letter,
        units: row.units,
      })),
    },
  };
};

// The decision stands, so an answer that this writer cannot read is a doubt, not a refusal.
const UNREAD = 'the record took the decision and gave an answer that this writer cannot read';

/** Confirm or refuse one name that waits. It answers the number of units that the rules decided
 * again. */
export const decideAuthorName = async (
  pool: Sessions,
  raw: string,
): Promise<DoorAct<{ readonly units: number }>> => {
  const given = readBody(raw, decision, 'the body names a name and a choice: confirm or refuse');
  if (given.outcome !== 'read') return given;
  const answer = await runStatement(pool, DECIDE, [given.body.name, given.body.confirm]);
  if (answer.outcome !== 'answered') return answer;
  const held = decidedRow.safeParse(answer.rows[0]);
  return held.success
    ? { outcome: 'done', reply: { units: held.data.units } }
    : { outcome: 'doubt', reply: { doubt: UNREAD } };
};
