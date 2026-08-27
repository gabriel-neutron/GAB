// Applies the ordered files, then gives the three login roles a password.
// The first migration creates them with LOGIN and no password, so none can authenticate.

import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';

import { type MigrationBuilder, runner } from 'node-pg-migrate';
import { Client } from 'pg';
import { z } from 'zod';

import { connectionString, secret, waitForDatabase } from './db-runtime.ts';

const MIGRATIONS = join(import.meta.dirname, '..', 'db', 'migrations');

// The default table name of node-pg-migrate. The option carries no default in its type.
const MIGRATIONS_TABLE = 'pgmigrations';

// The perimeter file revokes on every table of public, and it enumerates the six schema tables.
// A ledger in public is a table that no enumeration holds, so the ledger has a schema of its own.
const MIGRATIONS_SCHEMA = 'migrations';

const SQL_LOADER = [
  {
    extensions: ['.sql'],
    loader: (filePaths: readonly string[]) =>
      Promise.all(
        filePaths.map(async (filePath) => {
          const text = await readFile(filePath, 'utf8');
          return {
            id: filePath,
            filePaths: [filePath],
            actions: {
              up: (pgm: MigrationBuilder) => {
                pgm.sql(text);
              },
              down: false as const,
            },
          };
        }),
      ),
  },
];

const LOGIN_ROLES = [
  { role: 'gabriel_app', variable: 'GABRIEL_APP_PASSWORD' },
  { role: 'gabriel_agent', variable: 'GABRIEL_AGENT_PASSWORD' },
  { role: 'gabriel_read', variable: 'GABRIEL_READ_PASSWORD' },
] as const;

// Every secret is read before the first ALTER ROLE. An absent variable stops the command with
// no role changed, and not after two of the three roles hold a new password.
const setLoginPasswords = async (client: Client): Promise<void> => {
  const wanted = LOGIN_ROLES.map(({ role, variable }) => ({ role, password: secret(variable) }));

  for (const { role, password } of wanted) {
    // ALTER ROLE takes no bind parameter, so the value is escaped into the statement text.
    const statement = `ALTER ROLE ${role} PASSWORD ${client.escapeLiteral(password)}`;
    try {
      await client.query(statement);
    } catch {
      // The original error can quote the statement, and the statement holds the password.
      throw new Error(`The password of ${role} was refused.`);
    }
    console.log(`password set  ${role}`);
  }
};

const LEDGER = `${MIGRATIONS_SCHEMA}.${MIGRATIONS_TABLE}`;

// The ledger holds the file name without its extension, and it is absent on an empty database.
const ledgerExists = z.array(z.object({ present: z.boolean() })).length(1);
const ledgerRows = z.array(z.object({ name: z.string() }));

const namesThatRan = async (client: Client): Promise<ReadonlySet<string>> => {
  const found = ledgerExists.parse(
    (await client.query('SELECT to_regclass($1) IS NOT NULL AS present', [LEDGER])).rows,
  );
  if (found[0]?.present !== true) return new Set();
  const held = ledgerRows.parse((await client.query(`SELECT name FROM ${LEDGER}`)).rows);
  return new Set(held.map((row) => row.name));
};

/** The first ordered file the database never ran, or null when it ran every one. */
export const orderedFileNotRun = async (): Promise<string | null> => {
  const files = (await readdir(MIGRATIONS)).filter((name) => name.endsWith('.sql')).sort();
  const client = new Client({ connectionString: connectionString('superuser') });
  await client.connect();
  try {
    const ran = await namesThatRan(client);
    return files.find((name) => !ran.has(basename(name, '.sql'))) ?? null;
  } finally {
    await client.end();
  }
};

/** Runs every ordered file the database never ran, then gives each login role its password. */
export const runOrderedFiles = async (): Promise<void> => {
  await waitForDatabase();
  const client = new Client({ connectionString: connectionString('superuser') });
  await client.connect();
  try {
    await runner({
      dbClient: client,
      dir: MIGRATIONS,
      direction: 'up',
      migrationsTable: MIGRATIONS_TABLE,
      migrationsSchema: MIGRATIONS_SCHEMA,
      createMigrationsSchema: true,
      migrationLoaderStrategies: SQL_LOADER,
    });
    await setLoginPasswords(client);
  } finally {
    await client.end();
  }
};

if (argv[1] === fileURLToPath(import.meta.url)) {
  await runOrderedFiles().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
