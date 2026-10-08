// One SQL statement as the superuser, on the stack of this checkout. The user, the port and the
// compose project come from infra/.env, so nobody guesses them.

import { argv, exit } from 'node:process';

import { runScriptAsSuperuser } from './db-runtime.ts';

const [statement, database = 'gabriel_test'] = argv.slice(2);

if (statement === undefined || (database !== 'gabriel_test' && database !== 'gabriel')) {
  console.error('Usage: pnpm db:sql "<sql>" [gabriel_test | gabriel]');
  exit(1);
}

await runScriptAsSuperuser(statement, database).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
