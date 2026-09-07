import { Client } from 'pg';
import { z } from 'zod';

import { runLayout } from './layout-job.ts';

// The host, the port and the database name are fixed by the compose file of the local stack.
const HOST = '127.0.0.1';
const PORT = 5432;
const DATABASE = 'gabriel';

// The layout door is held by this role. It reads the graph and writes a drawing of it, and it
// signs nothing: a trigger stamps the author of a proposal from the name of the connection.
const ROLE = 'gabriel_agent';

const secrets = z.object({ GABRIEL_AGENT_PASSWORD: z.string().min(1) });

const address = (): string => {
  const held = secrets.safeParse(process.env);
  if (!held.success)
    throw new Error('GABRIEL_AGENT_PASSWORD is empty or absent. Set it in the environment file.');
  const password = encodeURIComponent(held.data.GABRIEL_AGENT_PASSWORD);
  return `postgresql://${ROLE}:${password}@${HOST}:${PORT}/${DATABASE}`;
};

// The run is taken by hand: the corpus moves when the operator promotes, and nothing else moves
// it, so this stands beside a batch of promotions and never on a clock.
const client = new Client({ connectionString: address() });
await client.connect();
try {
  const placed = await runLayout(client);
  console.log(`The layout run placed ${String(placed)} entities.`);
} finally {
  await client.end();
}
