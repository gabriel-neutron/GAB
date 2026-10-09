import { Pool } from 'pg';
import { z } from 'zod';

// Origin of the numbers: the compose file binds the database to 127.0.0.1:5432, so an absent
// variable reaches the local stack. A remote host sets all three, and it asks for TLS.
const absentWhenEmpty = (value: unknown): unknown => (value === '' ? undefined : value);
const placement = z.object({
  GABRIEL_DB_HOST: z.preprocess(absentWhenEmpty, z.string().trim().min(1).default('127.0.0.1')),
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

// External constraint: pg reads `sslmode=require` alone as verify-full, and a hosted database
// signs with its own authority. The compatibility flag gives the libpq meaning: encrypt only.
const PG_TLS_QUERY = '?uselibpqcompat=true&sslmode=require';

// External constraint: `gabriel_app` writes only through the doors it may execute. It reads the
// base tables that its checks need, and it holds no INSERT, UPDATE or DELETE on any table.
const ROLE = 'gabriel_app';

// Origin of the number: the role already stops a statement at 30 seconds, and the pool holds the
// same deadline. A promotion takes a row lock, so a blocked request must give its client back.
const STATEMENT_MS = 30_000;
const CONNECT_MS = 5_000;
const IDLE_MS = 10_000;

// Departure: the cluster holds the published record and the database the tests write. An absent
// name is the record, and a test run names the other one.
const secrets = z.object({
  PASSWORD: z.string().min(1),
  GABRIEL_DATABASE: z.enum(['gabriel', 'gabriel_test']).default('gabriel'),
});

/** The URL of one login role, from the variable of its password. It throws when it is absent. */
export const roleAddress = (role: string, variable: string): string => {
  const held = secrets.safeParse({ ...process.env, PASSWORD: process.env[variable] });
  if (!held.success)
    throw new Error(
      `${variable} is empty or absent, or GABRIEL_DATABASE names no database of the stack. ` +
        'Set them in the environment file.',
    );
  const where = placement.safeParse(process.env);
  if (!where.success)
    throw new Error(
      'GABRIEL_DB_HOST, GABRIEL_DB_PORT or GABRIEL_DB_SSL holds a value the writer cannot use. ' +
        'The port is a number from 1 to 65535, and GABRIEL_DB_SSL is true or false.',
    );
  const { GABRIEL_DB_HOST, GABRIEL_DB_PORT, GABRIEL_DB_SSL } = where.data;
  const password = encodeURIComponent(held.data.PASSWORD);
  const server = `${GABRIEL_DB_HOST}:${String(GABRIEL_DB_PORT)}`;
  const tls = GABRIEL_DB_SSL ? PG_TLS_QUERY : '';
  return `postgresql://${role}:${password}@${server}/${held.data.GABRIEL_DATABASE}${tls}`;
};

// Departure: a door reads less of the pool than `pg` declares. The pool of `pg` fits this shape,
// and a test lends a client that fails on the statement it names.
export interface Sessions {
  connect(): Promise<Session>;
}

export interface Session {
  query(text: string, values?: unknown[]): Promise<{ readonly rows: Record<string, unknown>[] }>;
  release(): void;
}

/** The one way to reach the database. It throws when the password is empty or absent. */
export const openPool = (): Pool => {
  const pool = new Pool({
    connectionString: roleAddress(ROLE, 'GABRIEL_APP_PASSWORD'),
    connectionTimeoutMillis: CONNECT_MS,
    idleTimeoutMillis: IDLE_MS,
    statement_timeout: STATEMENT_MS,
  });

  // External constraint: `pg` raises this event on the pool for a client that fails while it
  // waits, and an event that nobody hears throws. The writer must stay up when PostgreSQL restarts.
  pool.on('error', (cause) => {
    console.error('a pooled client failed while it waited', cause);
  });

  return pool;
};
