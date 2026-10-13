import { parseArgs } from 'node:util';

import { openStore, putObject } from '@gab/store';
import { webOf } from '@gab/tools/web';
import { Client } from 'pg';

import { agentAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { assetSites, flareSites, sweepFirms, type Site } from './firms-sweep.ts';

const USAGE =
  'Usage: pnpm worker firms-sweep [--since YYYY-MM-DD] [--flares <document> <text set> ' +
  '[--latitude <column>] [--longitude <column>]]. It reads NASA FIRMS for each asset of the ' +
  'record that has a point, and for each tile of the stored flare table. It stores one answer ' +
  'for each site and quarter, then the days since the last answer. Run it again after a stop, ' +
  'and run it each day to add the new days. The map key is FIRMS_MAP_KEY in the environment.';

/** Gives 1 when the run stopped at the rate limit or a period failed, and 2 for a usage fault. */
export const firmsSweepCommand: SubCommand = async (args) => {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      allowPositionals: true,
      strict: true,
      options: {
        since: { type: 'string', default: '2024-01-01' },
        flares: { type: 'boolean' },
        latitude: { type: 'string', default: 'latitude' },
        longitude: { type: 'string', default: 'longitude' },
      },
    });
    const { since, flares } = parsed.values;
    if (Number.isNaN(Date.parse(`${since}T00:00:00Z`))) throw new Error('--since is a day.');
    if (parsed.positionals.length !== (flares === true ? 2 : 0))
      throw new Error('--flares takes a document and a text set, and nothing else does.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
    console.error(USAGE);
    return 2;
  }
  const web = webOf(process.env);
  if (web.firmsKey === undefined) {
    console.error('FIRMS_MAP_KEY is empty or absent. Set it in the environment file.');
    return 1;
  }

  const store = openStore();
  const client = new Client({ connectionString: agentAddress() });
  await client.connect();
  try {
    const sites: Site[] = await assetSites(client);
    const [document = '', set = ''] = parsed.positionals;
    if (parsed.values.flares === true)
      sites.push(
        ...(await flareSites(client, {
          document,
          set,
          latitude: parsed.values.latitude,
          longitude: parsed.values.longitude,
        })),
      );
    const report = await sweepFirms(
      client,
      { web, store: { put: (object) => putObject(store, object) }, now: () => new Date() },
      sites,
      parsed.values.since,
    );
    // The lines hold sites and days, never an address or a key.
    console.log(
      `${String(sites.length)} sites: ${String(report.stored)} answers stored, ` +
        `${String(report.skipped)} quarters already stored.`,
    );
    for (const line of report.failed) console.error(line);
    if (report.stopped) console.error('Stopped at the rate limit. Run the command again.');
    return report.stopped || report.failed.length > 0 ? 1 : 0;
  } finally {
    await client.end();
    store.client.destroy();
  }
};
