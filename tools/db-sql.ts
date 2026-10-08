// A SQL script as the superuser, on the stack of this checkout. The user, the port and the compose
// project come from infra/.env, so nobody guesses them.

import { argv, exit } from 'node:process';

import { runScriptAsSuperuser } from './db-runtime.ts';
import { SESSION_PREFIX } from './stack-plan.ts';

const [script, database = 'gabriel_test'] = argv.slice(2);

if (script === undefined || (database !== 'gabriel_test' && database !== 'gabriel')) {
  console.error('Usage: pnpm db:sql "<sql>" [gabriel_test | gabriel]');
  exit(1);
}

// The record of the main stack is the published record, so this command writes to it only in a
// session stack, where the record is a copy that goes with the stack.
if (
  database === 'gabriel' &&
  !(process.env['COMPOSE_PROJECT_NAME'] ?? '').startsWith(SESSION_PREFIX)
) {
  console.error('db:sql reaches the database gabriel only in a session stack (`pnpm stack:up`).');
  exit(1);
}

await runScriptAsSuperuser(script, database).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
