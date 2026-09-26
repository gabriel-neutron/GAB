// The test database is built again from zero, beside the published record in the same cluster.
// The DROP names one literal database, so no argument can ever reach the record.

import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

import { applyRerunnableFiles } from './db-apply.ts';
import { loadCommittedFixture } from './db-load-fixture.ts';
import { runOrderedFiles } from './db-migrate.ts';
import { connectionString, waitForDatabase } from './db-runtime.ts';

// External constraint: DROP DATABASE and CREATE DATABASE run in no transaction block, and a
// session cannot drop the database it is connected to, so this session opens on the record.
const makeEmptyTestDatabase = async (): Promise<void> => {
  const client = new Client({ connectionString: connectionString('superuser', 'gabriel') });
  await client.connect();
  try {
    await client.query('DROP DATABASE IF EXISTS gabriel_test WITH (FORCE)');
    await client.query('CREATE DATABASE gabriel_test');
  } finally {
    await client.end();
  }
};

/** Builds the test database from zero with the ordered and re-runnable files, then the fixture. */
export const resetTestDatabase = async (): Promise<void> => {
  await waitForDatabase('gabriel');
  await makeEmptyTestDatabase();
  await runOrderedFiles('gabriel_test');
  await applyRerunnableFiles('gabriel_test');
  await loadCommittedFixture();
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  await resetTestDatabase().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
