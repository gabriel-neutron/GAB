import { Pool } from 'pg';
import { z } from 'zod';

// External constraint: the host and the port are fixed by the compose file of the local stack.
const HOST = '127.0.0.1';
const PORT = 5432;

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
  GABRIEL_APP_PASSWORD: z.string().min(1),
  GABRIEL_DATABASE: z.enum(['gabriel', 'gabriel_test']).default('gabriel'),
});

const address = (): string => {
  const held = secrets.safeParse(process.env);
  if (!held.success)
    throw new Error(
      'GABRIEL_APP_PASSWORD is empty or absent, or GABRIEL_DATABASE names no database of the ' +
        'stack. Set them in the environment file.',
    );
  const password = encodeURIComponent(held.data.GABRIEL_APP_PASSWORD);
  return `postgresql://${ROLE}:${password}@${HOST}:${PORT}/${held.data.GABRIEL_DATABASE}`;
};

/** The one way to reach the database. It throws when the password is empty or absent. */
export const openPool = (): Pool => {
  const pool = new Pool({
    connectionString: address(),
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
