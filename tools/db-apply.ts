// External constraint: each file is its own psql run, over stdin, and no file is wrapped in a
// transaction. An apply file uses SET ROLE, which a transaction undoes.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { runScriptAsSuperuser } from './db-runtime.ts';
import { chosenDatabase, type DatabaseName } from './test-database.ts';

const APPLY = join(import.meta.dirname, '..', 'db', 'apply');

/** Feeds every re-runnable file to the database, in order, and wakes the schema cache. */
export const applyRerunnableFiles = async (
  database: DatabaseName = chosenDatabase(process.env),
): Promise<void> => {
  const files = (await readdir(APPLY)).filter((name) => name.endsWith('.sql')).sort();
  for (const name of files) {
    console.log(`apply  ${name}`);
    await runScriptAsSuperuser(await readFile(join(APPLY, name), 'utf8'), database);
  }

  // External constraint: a separate process holds the schema cache, and a new view does not reach
  // it. The channel needs no listener, so this succeeds when that process is down.
  await runScriptAsSuperuser("NOTIFY pgrst, 'reload schema';\n", database);
  console.log('notify schema cache');
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  await applyRerunnableFiles().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
