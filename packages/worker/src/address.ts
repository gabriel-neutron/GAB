import { z } from 'zod';

// External constraint: the compose file of the local stack fixes the database name.
const DATABASE = 'gabriel';

// External constraint: the doors of the machine layer are held by this role. It reads the corpus
// and writes through a door, and it signs nothing: a trigger stamps the author from the connection.
const ROLE = 'gabriel_agent';

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

const secrets = z.object({ GABRIEL_AGENT_PASSWORD: z.string().min(1) });

/** The URL a hand-taken command of this package signs with. It throws when the secret is absent. */
export const agentAddress = (): string => {
  const held = secrets.safeParse(process.env);
  if (!held.success)
    throw new Error('GABRIEL_AGENT_PASSWORD is empty or absent. Set it in the environment file.');
  const where = placement.safeParse(process.env);
  if (!where.success)
    throw new Error(
      'GABRIEL_DB_HOST, GABRIEL_DB_PORT or GABRIEL_DB_SSL holds a value the worker cannot use. ' +
        'The port is a number from 1 to 65535, and GABRIEL_DB_SSL is true or false.',
    );
  const { GABRIEL_DB_HOST, GABRIEL_DB_PORT, GABRIEL_DB_SSL } = where.data;
  const password = encodeURIComponent(held.data.GABRIEL_AGENT_PASSWORD);
  const server = `${GABRIEL_DB_HOST}:${String(GABRIEL_DB_PORT)}`;
  const tls = GABRIEL_DB_SSL ? PG_TLS_QUERY : '';
  return `postgresql://${ROLE}:${password}@${server}/${DATABASE}${tls}`;
};
