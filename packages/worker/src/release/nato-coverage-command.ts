import { Client } from 'pg';

import { appAddress } from '../address.ts';
import type { SubCommand } from '../command.ts';
import { natoCoverageReport } from './nato-coverage.ts';
import { inOneSnapshot } from './snapshot.ts';

const USAGE = 'Usage: pnpm worker nato-coverage';

// Departure: the role waits 30 seconds for one statement, and the report reads the whole record
// and the pair of each claim. The command runs on the machine of the operator, by hand.
const COVERAGE_TIMEOUT = '10min';

/** Prints the number and the share of the public claims with a full NATO pair, in all and by
 * entity type and relation type. It writes nothing. */
export const natoCoverageCommand: SubCommand = async (args) => {
  if (args.length > 0) {
    console.error(USAGE);
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    await client.query(`SET statement_timeout = '${COVERAGE_TIMEOUT}'`);
    const lines = await inOneSnapshot(client, () => natoCoverageReport(client));
    for (const line of lines) console.log(line);
    return 0;
  } finally {
    await client.end();
  }
};
