// A live test project runs this once before its first test. A test database that lags behind the
// migrations makes hundreds of tests fail with one cause, and this check names that cause instead.

import { orderedFileNotRun } from './db-migrate.ts';

export default async function setup(): Promise<void> {
  const missing = await orderedFileNotRun('gabriel_test');
  if (missing !== null)
    throw new Error(
      `The test database never ran the migration ${missing}. Run \`pnpm db:reset\`, then run the ` +
        'tests again.',
    );
  // shortcut: the check reads the migrations only, and a change to db/apply alone passes it.
  // Upgrade it when such a change makes the tests fail with no clear cause.
}
