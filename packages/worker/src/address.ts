import { z } from 'zod';

// The host, the port and the database name are fixed by the compose file of the local stack.
const HOST = '127.0.0.1';
const PORT = 5432;
const DATABASE = 'gabriel';

// The doors of the machine layer are held by this role. It reads the corpus and writes through a
// door, and it signs nothing: a trigger stamps the author of a proposal from the name of the
// connection.
const ROLE = 'gabriel_agent';

const secrets = z.object({ GABRIEL_AGENT_PASSWORD: z.string().min(1) });

/** The URL a hand-taken command of this package signs with. It throws when the secret is absent. */
export const agentAddress = (): string => {
  const held = secrets.safeParse(process.env);
  if (!held.success)
    throw new Error('GABRIEL_AGENT_PASSWORD is empty or absent. Set it in the environment file.');
  const password = encodeURIComponent(held.data.GABRIEL_AGENT_PASSWORD);
  return `postgresql://${ROLE}:${password}@${HOST}:${PORT}/${DATABASE}`;
};
