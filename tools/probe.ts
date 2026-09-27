import { Client } from 'pg';

import { connectionString } from './db-runtime.ts';

type Identity = Parameters<typeof connectionString>[0];

export type Ask = (text: string, values?: readonly unknown[]) => Promise<readonly unknown[]>;

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

// External constraint: the ledger and the documents refuse a delete, so the rollback is the only
// way back. A refusal that a regressed grant lets through then commits nothing.
export const rolledBack = <T>(identity: Identity, work: (ask: Ask) => Promise<T>): Promise<T> =>
  probe(identity, async (ask) => {
    await ask('BEGIN');
    try {
      return await work(ask);
    } finally {
      await ask('ROLLBACK');
    }
  });
