import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { Client } from 'pg';
import { z } from 'zod';

import { chosenDatabase, type DatabaseName } from './test-database.ts';

const ROOT = join(import.meta.dirname, '..');
const COMPOSE_FILE = join(ROOT, 'infra', 'docker-compose.yml');
const ENV_FILE = join(ROOT, 'infra', '.env');
// Departure: a session stack of a worktree names its own compose project in infra/.env. The main
// checkout names none, so it keeps the one shared stack.
const PROJECT = process.env['COMPOSE_PROJECT_NAME'] ?? 'gab';

// External constraint: the bootstrap superuser owns the schema. gabriel_app runs the promoted acts,
// gabriel_agent runs the proposal door only, gabriel_research proposes and stores fetched documents
// only, and gabriel_read reads the api schema only, so a
// test of the perimeter must log in as it.
const LOGIN_ROLES = {
  app: { role: 'gabriel_app', variable: 'GABRIEL_APP_PASSWORD' },
  agent: { role: 'gabriel_agent', variable: 'GABRIEL_AGENT_PASSWORD' },
  research: { role: 'gabriel_research', variable: 'GABRIEL_RESEARCH_PASSWORD' },
  read: { role: 'gabriel_read', variable: 'GABRIEL_READ_PASSWORD' },
} as const;

const LOGIN = {
  superuser: { role: 'gabriel', variable: 'POSTGRES_PASSWORD' },
  ...LOGIN_ROLES,
} as const;

// Origin of the numbers: the compose file binds the database to 127.0.0.1:5432, so an absent
// variable reaches the local stack. A remote host sets all three, and it asks for TLS.
const absentWhenEmpty = (value: unknown): unknown => (value === '' ? undefined : value);
const placement = z.object({
  GABRIEL_DB_HOST: z.preprocess(absentWhenEmpty, z.string().default('127.0.0.1')),
  GABRIEL_DB_PORT: z.preprocess(
    absentWhenEmpty,
    z.coerce.number().int().min(1).max(65_535).default(5432),
  ),
  GABRIEL_DB_SSL: z.preprocess(
    absentWhenEmpty,
    z
      .enum(['true', 'false'])
      .default('false')
      .transform((stated) => stated === 'true'),
  ),
});

interface Placement {
  readonly host: string;
  readonly port: number;
  readonly tls: boolean;
}

const placementOf = (environment: NodeJS.ProcessEnv): Placement => {
  const held = placement.safeParse(environment);
  if (!held.success) {
    throw new Error(
      'GABRIEL_DB_HOST, GABRIEL_DB_PORT or GABRIEL_DB_SSL holds a value the tools cannot use. ' +
        'The port is a number from 1 to 65535, and GABRIEL_DB_SSL is true or false.',
    );
  }
  const { GABRIEL_DB_HOST, GABRIEL_DB_PORT, GABRIEL_DB_SSL } = held.data;
  return { host: GABRIEL_DB_HOST, port: GABRIEL_DB_PORT, tls: GABRIEL_DB_SSL };
};

// External constraint: pg reads `sslmode=require` alone as verify-full, and a hosted database
// signs with its own authority. The compatibility flag gives the libpq meaning: encrypt only.
const PG_TLS_QUERY = '?uselibpqcompat=true&sslmode=require';

// Origin of the numbers: a first boot runs the init scripts of the image after the healthcheck
// reports ready. Two minutes is the longest first boot measured on a laptop with a cold image.
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

/** The URL of one named identity of one database, with its password, at the configured host. */
export const connectionString = (
  identity: keyof typeof LOGIN,
  database: DatabaseName = chosenDatabase(process.env),
): string => {
  const { role, variable } = LOGIN[identity];
  const password = encodeURIComponent(secret(variable));
  const { host, port, tls } = placementOf(process.env);
  return `postgresql://${role}:${password}@${host}:${port}/${database}${tls ? PG_TLS_QUERY : ''}`;
};

/** The password of each login role other than the superuser. An absent secret throws. */
export const loginPasswords = (): readonly { role: string; password: string }[] =>
  Object.values(LOGIN_ROLES).map(({ role, variable }) => ({ role, password: secret(variable) }));

// External constraint: each value travels as a variable, so no password is on a command line.
const libpqVariables = (database: DatabaseName): Readonly<Record<string, string>> => {
  const { host, port, tls } = placementOf(process.env);
  return {
    PGHOST: host,
    PGPORT: String(port),
    PGUSER: LOGIN.superuser.role,
    PGPASSWORD: secret(LOGIN.superuser.variable),
    PGDATABASE: database,
    PGSSLMODE: tls ? 'require' : 'disable',
  };
};

const PSQL_FLAGS = ['-v', 'ON_ERROR_STOP=1'] as const;

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost']);
const CONTAINER_PORT = '5432';

const isAbsentProgram = (error: Error): boolean => 'code' in error && error.code === 'ENOENT';

// External constraint: a program that fails to start closes no stdin, and a write to it throws.
// So the script goes in only after the start.
const feedScript = (
  program: string,
  args: readonly string[],
  script: string,
  env: NodeJS.ProcessEnv,
): Promise<'ran' | 'absent'> =>
  new Promise((resolve, reject) => {
    const child = spawn(program, args, { env, stdio: ['pipe', 'inherit', 'inherit'] });

    child.on('spawn', () => {
      child.stdin.end(script);
    });
    child.on('error', (error) => {
      if (isAbsentProgram(error)) resolve('absent');
      else reject(error);
    });
    child.on('close', (code) => {
      if (code === 0) resolve('ran');
      else reject(new Error(`${program} stopped with the code ${code}.`));
    });
  });

/** Runs one SQL script as the superuser in one psql session, fed over stdin, in no transaction. */
export const runScriptAsSuperuser = async (
  script: string,
  database: DatabaseName,
): Promise<void> => {
  const variables = libpqVariables(database);
  const env = { ...process.env, ...variables };
  if ((await feedScript('psql', PSQL_FLAGS, script, env)) === 'ran') return;

  // Departure: a host with no psql uses the one in the local database container. That psql reaches
  // the configured host over the network, so a remote target then needs the local stack to run.
  // When the target is the database of this stack, psql inside the container reaches it on the
  // port inside the container, not on the published one.
  const published = process.env['GAB_DB_PORT'] ?? CONTAINER_PORT;
  const isThisStack =
    LOCAL_HOSTS.has(variables['PGHOST'] ?? '') && variables['PGPORT'] === published;
  const inside = isThisStack ? { PGPORT: CONTAINER_PORT } : {};
  const passed = Object.keys(variables).flatMap((name) => ['-e', name]);
  const inContainer = await feedScript(
    'docker',
    [
      ...['compose', '--env-file', ENV_FILE, '-f', COMPOSE_FILE, '-p', PROJECT],
      ...['exec', '-T', ...passed, 'db', 'psql', ...PSQL_FLAGS],
    ],
    script,
    { ...env, ...inside },
  );
  if (inContainer === 'absent') {
    throw new Error(`Neither psql nor docker is on the PATH, so no script reaches ${database}.`);
  }
};

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
