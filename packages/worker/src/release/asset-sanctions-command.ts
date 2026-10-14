import { parseArgs } from 'node:util';

import { Client } from 'pg';

import { appAddress } from '../address.ts';
import type { SubCommand } from '../command.ts';
import { assetSanctions, statusLines } from './asset-sanctions.ts';
import { readReleaseRecord } from './release-record.ts';
import { inOneSnapshot } from './snapshot.ts';

const USAGE = 'Usage: pnpm worker asset-sanctions [--as-of YYYY-MM-DD] [--json] [--all]';

const SANCTIONS_TIMEOUT = '10min';

const DAY = /^\d{4}-\d{2}-\d{2}$/u;

/** Prints the sanctions status of each asset of the public record: listed or derived, and with
 * `--all` also none. Each status gives its regime, its act and its date, the shares of a derived
 * status (a share that GEM estimated says so) and the general licences. It writes nothing. */
export const assetSanctionsCommand: SubCommand = async (args) => {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      strict: true,
      options: {
        'as-of': { type: 'string', default: new Date().toISOString().slice(0, 10) },
        json: { type: 'boolean' },
        all: { type: 'boolean' },
      },
    });
    const day = parsed.values['as-of'];
    if (!DAY.test(day) || new Date(day).toISOString().slice(0, 10) !== day)
      throw new Error('--as-of is a day.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
    console.error(USAGE);
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    await client.query(`SET statement_timeout = '${SANCTIONS_TIMEOUT}'`);
    const record = await inOneSnapshot(client, () =>
      readReleaseRecord(client, { natoPair: false }),
    );
    const shown = assetSanctions(record, parsed.values['as-of']).filter(
      (one) => parsed.values.all === true || one.status !== 'none',
    );
    if (parsed.values.json === true) console.log(JSON.stringify(shown, null, 2));
    else for (const one of shown) for (const line of statusLines(one)) console.log(line);
    return 0;
  } finally {
    await client.end();
  }
};
