import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { findNameCandidates } from './name-candidates/name-candidates.ts';

/** Finds the merge candidates across a Latin and a Cyrillic spelling, as the operator role, and
 * stores them for the review page. */
export const nameCandidatesCommand: SubCommand = async (args) => {
  if (args.length > 0) {
    console.error('Usage: pnpm worker name-candidates');
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    await client.query('BEGIN');
    const run = await findNameCandidates(client);
    await client.query('COMMIT');
    console.log(
      `${String(run.names)} names read. ${String(run.found)} pairs found: ` +
        `${String(run.added)} new, ${String(run.kept)} known already. ` +
        `${String(run.dropped)} waiting pairs were not found again and left the list.`,
    );
    return 0;
  } catch (fault) {
    await client.query('ROLLBACK');
    throw fault;
  } finally {
    await client.end();
  }
};
