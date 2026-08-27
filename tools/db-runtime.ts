// The shared parts of the three database commands. Nothing here runs on import.

import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { Client } from 'pg';

const ROOT = join(import.meta.dirname, '..');
const COMPOSE_FILE = join(ROOT, 'infra', 'docker-compose.yml');
const ENV_FILE = join(ROOT, 'infra', '.env');
const PROJECT = 'gab';

// The host, the port and the database name are fixed by the compose file.
const HOST = '127.0.0.1';
const PORT = 5432;
const DATABASE = 'gabriel';

// The bootstrap superuser owns the schema. gabriel_app holds EXECUTE on the promoted acts, and
// gabriel_agent holds EXECUTE on the proposal door only, so the machine layer stays separate.
// gabriel_read reads the api schema only, and a test of the perimeter must log in as it.
const LOGIN = {
  superuser: { role: 'gabriel', variable: 'POSTGRES_PASSWORD' },
  app: { role: 'gabriel_app', variable: 'GABRIEL_APP_PASSWORD' },
  agent: { role: 'gabriel_agent', variable: 'GABRIEL_AGENT_PASSWORD' },
  read: { role: 'gabriel_read', variable: 'GABRIEL_READ_PASSWORD' },
} as const;

// A first boot runs the init scripts of the image after the healthcheck reports ready.
// Two minutes is the longest first boot measured on a laptop with a cold image.
const READY_DEADLINE_MS = 120_000;
const READY_INTERVAL_MS = 1_000;

/** The value of one secret of the environment. It throws when the variable is empty or absent. */
export const secret = (variable: string): string => {
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

/** The URL of one named identity of the local database, with its password. */
export const connectionString = (identity: keyof typeof LOGIN): string => {
  const { role, variable } = LOGIN[identity];
  const password = encodeURIComponent(secret(variable));
  return `postgresql://${role}:${password}@${HOST}:${PORT}/${DATABASE}`;
};

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
export const waitForDatabase = async (): Promise<void> => {
  const url = connectionString('superuser');
  const deadline = Date.now() + READY_DEADLINE_MS;

  for (;;) {
    if (await accepts(url)) return;
    if (Date.now() >= deadline) {
      throw new Error(`The database did not accept a connection in ${READY_DEADLINE_MS} ms.`);
    }
    await sleep(READY_INTERVAL_MS);
  }
};
