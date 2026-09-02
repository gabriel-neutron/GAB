import { Pool } from 'pg';
import { z } from 'zod';

// The host, the port and the database name are fixed by the compose file of the local stack.
const HOST = '127.0.0.1';
const PORT = 5432;
const DATABASE = 'gabriel';

// A trigger stamps the author of a proposal from this name, so a worker that logged in as the
// operator's role would sign every machine proposal with the operator's name. The claim door
// reaches this role on the day the door that releases a claim exists.
const ROLE = 'gabriel_agent';

// The role already stops a statement at 30 seconds, and the pool holds the same deadline. A
// claim takes a row lock for the length of its transaction, so a blocked worker must give its
// client back to the pool.
const STATEMENT_MS = 30_000;
const CONNECT_MS = 5_000;
const IDLE_MS = 10_000;

const secrets = z.object({ GABRIEL_AGENT_PASSWORD: z.string().min(1) });

const address = (): string => {
  const held = secrets.safeParse(process.env);
  if (!held.success)
    throw new Error('GABRIEL_AGENT_PASSWORD is empty or absent. Set it in the environment file.');
  const password = encodeURIComponent(held.data.GABRIEL_AGENT_PASSWORD);
  return `postgresql://${ROLE}:${password}@${HOST}:${PORT}/${DATABASE}`;
};

/** The one way a worker reaches the database. It throws when the password is empty or absent. */
export const openAgentPool = (): Pool => {
  const pool = new Pool({
    connectionString: address(),
    connectionTimeoutMillis: CONNECT_MS,
    idleTimeoutMillis: IDLE_MS,
    statement_timeout: STATEMENT_MS,
  });

  // `pg` raises this event on the pool for a client that fails while it waits, and an event that
  // nobody hears throws. A worker must stay up when PostgreSQL restarts.
  pool.on('error', (cause) => {
    console.error('a pooled client failed while it waited', cause);
  });

  return pool;
};
