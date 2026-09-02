// One connection for one probe. The client, the login and the close stay inside, so a test
// states a role and a statement only.

import { Client } from 'pg';

import { connectionString } from './db-runtime.ts';

type Identity = 'superuser' | 'app' | 'agent' | 'read';

type Ask = (text: string, values?: readonly unknown[]) => Promise<readonly unknown[]>;

export const probe = async <T>(identity: Identity, work: (ask: Ask) => Promise<T>): Promise<T> => {
  const client = new Client({ connectionString: connectionString(identity) });
  await client.connect();
  try {
    return await work(async (text, values) => {
      const found = await client.query<Record<string, unknown>>(
        text,
        values === undefined ? undefined : [...values],
      );
      return found.rows;
    });
  } finally {
    await client.end();
  }
};
