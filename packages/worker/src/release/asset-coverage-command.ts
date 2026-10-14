import { readFile } from 'node:fs/promises';

import { Client } from 'pg';

import { appAddress } from '../address.ts';
import type { SubCommand } from '../command.ts';
import { assetCoverageReport, totalsShape, type CapacityTotals } from './asset-coverage.ts';
import { inOneSnapshot } from './snapshot.ts';

const USAGE = 'Usage: pnpm worker asset-coverage [totals.json]';

// Departure: the role waits 30 seconds for one statement, and the report reads the whole record.
// The command runs on the machine of the operator, by hand.
const COVERAGE_TIMEOUT = '10min';

/** Prints the coverage of each kind of asset: the assets, those with a geometry, an operator, an
 * owner and a sanctions relation, and the share of the capacity that they hold. The optional file
 * gives, for each kind, the total capacity, its unit, the attribute of the asset capacity and the
 * source of the total. With no file, the report gives counts and no share. It writes nothing. */
export const assetCoverageCommand: SubCommand = async (args) => {
  if (args.length > 1) {
    console.error(USAGE);
    return 2;
  }
  const [file] = args;
  let totals: CapacityTotals = {};
  if (file !== undefined) {
    const parsed = totalsShape.safeParse(JSON.parse(await readFile(file, 'utf8')));
    if (!parsed.success) {
      console.error(`The totals file is not valid: ${parsed.error.message}`);
      return 2;
    }
    totals = parsed.data;
  }
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    await client.query(`SET statement_timeout = '${COVERAGE_TIMEOUT}'`);
    const lines = await inOneSnapshot(client, () => assetCoverageReport(client, totals));
    for (const line of lines) console.log(line);
    return 0;
  } finally {
    await client.end();
  }
};
