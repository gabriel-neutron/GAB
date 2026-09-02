import { Pool } from 'pg';
import { z } from 'zod';

// The host, the port and the database name are fixed by the compose file of the local stack.
const HOST = '127.0.0.1';
const PORT = 5432;
const DATABASE = 'gabriel';

// `gabriel_app` holds EXECUTE on the four doors and no INSERT, UPDATE or DELETE on any table.
const ROLE = 'gabriel_app';

// The role already stops a statement at 30 seconds, and the pool holds the same deadline. A
// promotion takes a row lock, so a blocked request must give its client back to the pool.
const STATEMENT_MS = 30_000;
const CONNECT_MS = 5_000;
const IDLE_MS = 10_000;

const secrets = z.object({ GABRIEL_APP_PASSWORD: z.string().min(1) });

const address = (): string => {
  const held = secrets.safeParse(process.env);
  if (!held.success)
    throw new Error('GABRIEL_APP_PASSWORD is empty or absent. Set it in the environment file.');
  const password = encodeURIComponent(held.data.GABRIEL_APP_PASSWORD);
  return `postgresql://${ROLE}:${password}@${HOST}:${PORT}/${DATABASE}`;
};

/** The one way to reach the database. It throws when the password is empty or absent. */
export const openPool = (): Pool => {
  const pool = new Pool({
    connectionString: address(),
    connectionTimeoutMillis: CONNECT_MS,
    idleTimeoutMillis: IDLE_MS,
    statement_timeout: STATEMENT_MS,
  });

  // `pg` raises this event on the pool for a client that fails while it waits, and an event
  // that nobody hears throws. The writer must stay up when PostgreSQL restarts.
  pool.on('error', (cause) => {
    console.error('a pooled client failed while it waited', cause);
  });

  return pool;
};
