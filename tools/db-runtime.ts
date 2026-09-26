// The shared parts of the three database commands. Nothing here runs on import.

import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { Client } from 'pg';

import { chosenDatabase, type DatabaseName } from './test-database.ts';

const ROOT = join(import.meta.dirname, '..');
const COMPOSE_FILE = join(ROOT, 'infra', 'docker-compose.yml');
const ENV_FILE = join(ROOT, 'infra', '.env');
const PROJECT = 'gab';

// The host and the port are fixed by the compose file.
const HOST = '127.0.0.1';
const PORT = 5432;

// The bootstrap superuser owns the schema. gabriel_app holds EXECUTE on the promoted acts, and
// gabriel_agent holds EXECUTE on the proposal door only, so the machine layer stays separate.
// gabriel_read reads the api schema only, and a test of the perimeter must log in as it.
const LOGIN_ROLES = {
  app: { role: 'gabriel_app', variable: 'GABRIEL_APP_PASSWORD' },
  agent: { role: 'gabriel_agent', variable: 'GABRIEL_AGENT_PASSWORD' },
  read: { role: 'gabriel_read', variable: 'GABRIEL_READ_PASSWORD' },
} as const;

const LOGIN = {
  superuser: { role: 'gabriel', variable: 'POSTGRES_PASSWORD' },
  ...LOGIN_ROLES,
} as const;

// A first boot runs the init scripts of the image after the healthcheck reports ready.
// Two minutes is the longest first boot measured on a laptop with a cold image.
const READY_DEADLINE_MS = 120_000;
const READY_INTERVAL_MS = 1_000;

const secret = (variable: string): string => {
  const value = process.env[variable];
  if (value === undefined || value === '') {
    throw new Error(`The variable ${variable} is empty or absent. Set it in infra/.env.`);
  }
  return value;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** The URL of one named identity of one local database, with its password. */
export const connectionString = (
  identity: keyof typeof LOGIN,
  database: DatabaseName = chosenDatabase(process.env),
): string => {
  const { role, variable } = LOGIN[identity];
  const password = encodeURIComponent(secret(variable));
  return `postgresql://${role}:${password}@${HOST}:${PORT}/${database}`;
};

/** The password of each login role other than the superuser. An absent secret throws. */
export const loginPasswords = (): readonly { role: string; password: string }[] =>
  Object.values(LOGIN_ROLES).map(({ role, variable }) => ({ role, password: secret(variable) }));

/** Runs one `docker compose` command against the local stack, and writes `input` to its stdin. */
export const compose = (args: readonly string[], input?: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'docker',
      ['compose', '--env-file', ENV_FILE, '-f', COMPOSE_FILE, '-p', PROJECT, ...args],
      { stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'] },
    );

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`docker compose ${args.join(' ')} stopped with the code ${code}.`));
    });

    if (input !== undefined) child.stdin?.end(input);
  });

const accepts = async (url: string): Promise<boolean> => {
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
};

/** Waits until the database accepts a connection, because the healthcheck reports ready first. */
export const waitForDatabase = async (
  database: DatabaseName = chosenDatabase(process.env),
): Promise<void> => {
  const url = connectionString('superuser', database);
  const deadline = Date.now() + READY_DEADLINE_MS;

  for (;;) {
    if (await accepts(url)) return;
    if (Date.now() >= deadline) {
      throw new Error(`The database did not accept a connection in ${READY_DEADLINE_MS} ms.`);
    }
    await sleep(READY_INTERVAL_MS);
  }
};
