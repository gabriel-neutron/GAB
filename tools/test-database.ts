// The record and the test database live in one PostgreSQL cluster, so one variable picks the
// database. A test writes rows the append-only ledger keeps for ever, and the record is published.

import { z } from 'zod';

/** The two databases of the cluster: the published record, and the one the tests write. */
export type DatabaseName = 'gabriel' | 'gabriel_test';

const named = z.object({ GABRIEL_DATABASE: z.enum(['gabriel', 'gabriel_test']).optional() });

type Environment = Readonly<Record<string, string | undefined>>;

/** The database a command reaches. The record when the environment names none. */
export const chosenDatabase = (environment: Environment): DatabaseName => {
  const held = named.safeParse(environment);
  if (!held.success)
    throw new Error('GABRIEL_DATABASE names no database of the stack: gabriel or gabriel_test.');
  return held.data.GABRIEL_DATABASE ?? 'gabriel';
};

/** The database a test run reaches. It throws when the environment names the record. */
export const testRunDatabase = (environment: Environment): 'gabriel_test' => {
  const stated = environment['GABRIEL_DATABASE'];
  if (stated !== undefined && stated !== 'gabriel_test')
    throw new Error(
      `A test run reaches gabriel_test only, and GABRIEL_DATABASE names ${stated}. ` +
        'The tests write rows the ledger never deletes. Unset the variable.',
    );
  return 'gabriel_test';
};
