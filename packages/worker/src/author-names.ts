import { z } from 'zod';

import type { Queryable } from './queryable.ts';

// A name that joined an author A or B waits for the operator. Only the operator role holds these
// doors, so the worker role and the research role cannot decide a name.

const WAITING =
  'SELECT name_key, author, letter::text AS letter, units FROM public.author_names_waiting()';
const DRY_RUN = `SELECT name_key, author, letter::text AS letter, units, change_if_confirmed,
       change_if_refused
  FROM public.author_names_dry_run()`;
const DECIDE = 'SELECT public.decide_author_name($1::text, $2::boolean) AS units';

const waitingRow = z.object({
  name_key: z.string(),
  author: z.string(),
  letter: z.string(),
  units: z.number().int(),
});

const dryRunRow = waitingRow.extend({
  change_if_confirmed: z.number().int(),
  change_if_refused: z.number().int(),
});

export type WaitingName = z.infer<typeof waitingRow>;
export type DryRunName = z.infer<typeof dryRunRow>;

/** The names that wait, the largest first. */
export const readWaitingNames = async (db: Queryable): Promise<WaitingName[]> =>
  z.array(waitingRow).parse((await db.query(WAITING)).rows);

/** For each name that waits, the number of units whose rule would change. It writes nothing. */
export const dryRunNames = async (db: Queryable): Promise<DryRunName[]> =>
  z.array(dryRunRow).parse((await db.query(DRY_RUN)).rows);

/** Confirms or refuses one name, and gives the number of its units that the rules read again. */
export const decideName = async (
  db: Queryable,
  name: string,
  confirm: boolean,
): Promise<number> => {
  const [row] = z
    .array(z.object({ units: z.number().int() }))
    .length(1)
    .parse((await db.query(DECIDE, [name, confirm])).rows);
  return row?.units ?? 0;
};

/** One line for each name: the name, the author that it joined with its letter, and its units. */
export const waitingLines = (rows: readonly WaitingName[]): string[] => [
  ...rows.map(
    (one) => `${one.name_key}  ->  ${one.author} (${one.letter})  ${String(one.units)} units`,
  ),
  `${String(rows.length)} names wait for a decision.`,
];

/** The same lines, with the changes of each decision. */
export const dryRunLines = (rows: readonly DryRunName[]): string[] => [
  ...rows.map(
    (one) =>
      `${one.name_key}  ->  ${one.author} (${one.letter})  ${String(one.units)} units: ` +
      `confirm changes ${String(one.change_if_confirmed)}, refuse changes ` +
      String(one.change_if_refused),
  ),
  `${String(rows.length)} names wait for a decision. The dry-run wrote nothing.`,
];
