// External constraint: all the files run in one psql run, over stdin, in one transaction. A failure
// in any file changes nothing, and the roles keep their grants: 20_views.sql drops and makes each api
// view again, and only 90_grants.sql grants it, so a commit after each file would leave the views
// with no grant when a later file fails. An apply file uses SET ROLE, and a transaction does not
// undo it: in a committed transaction, SET ROLE holds for the session. So each file resets its role
// at its end.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { runScriptAsSuperuser } from './db-runtime.ts';
import { chosenDatabase, type DatabaseName } from './test-database.ts';

const APPLY = join(import.meta.dirname, '..', 'db', 'apply');

/** Runs re-runnable files, in order, in one transaction. With ON_ERROR_STOP, psql stops at the
 * first error, and the server rolls the open transaction back. */
export const applyFiles = (scripts: readonly string[], database: DatabaseName): Promise<void> =>
  runScriptAsSuperuser(
    `BEGIN;
${scripts.join('\n')}
COMMIT;
`,
    database,
  );

/** Runs one re-runnable file in one transaction. */
export const applyFile = (script: string, database: DatabaseName): Promise<void> =>
  applyFiles([script], database);

/** Feeds every re-runnable file to the database, in order, and wakes the schema cache. */
export const applyRerunnableFiles = async (
  database: DatabaseName = chosenDatabase(process.env),
): Promise<void> => {
  const files = (await readdir(APPLY)).filter((name) => name.endsWith('.sql')).sort();
  const scripts: string[] = [];
  for (const name of files) {
    console.log(`apply  ${name}`);
    scripts.push(await readFile(join(APPLY, name), 'utf8'));
  }
  await applyFiles(scripts, database);

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
