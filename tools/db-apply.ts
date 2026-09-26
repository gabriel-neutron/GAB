// Feeds each re-runnable file to psql inside the container, over stdin.
// No file is wrapped in a transaction: an apply file uses SET ROLE, which a transaction undoes.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { compose } from './db-runtime.ts';
import { chosenDatabase, type DatabaseName } from './test-database.ts';

const APPLY = join(import.meta.dirname, '..', 'db', 'apply');

const psqlOn = (database: DatabaseName): readonly string[] => [
  'exec',
  '-T',
  'db',
  'psql',
  '-v',
  'ON_ERROR_STOP=1',
  '-U',
  'gabriel',
  '-d',
  database,
];

/** Feeds every re-runnable file to the database, in order, and wakes the schema cache. */
export const applyRerunnableFiles = async (
  database: DatabaseName = chosenDatabase(process.env),
): Promise<void> => {
  const psql = psqlOn(database);
  const files = (await readdir(APPLY)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files) {
    console.log(`apply  ${name}`);
    await compose(psql, await readFile(join(APPLY, name), 'utf8'));
  }

  // External constraint: a separate process holds the schema cache, and a new view does not reach
  // it. The channel needs no listener, so this succeeds when that process is down.
  await compose(psql, "NOTIFY pgrst, 'reload schema';\n");
  console.log('notify schema cache');
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  await applyRerunnableFiles().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
