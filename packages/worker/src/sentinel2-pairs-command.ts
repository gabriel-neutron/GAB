import { parseArgs } from 'node:util';

import { openStore, putObject } from '@gab/store';
import { webOf } from '@gab/tools/web';
import { Client } from 'pg';

import { agentAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { pairStrikes, strikesOf } from './sentinel2-pairs.ts';

const USAGE =
  'Usage: pnpm worker sentinel2-pairs [--list] [--max-cloud <share>] [--half-width <metres>]. It ' +
  'reads the accepted strikes with a day and a site point, and stores a clear Sentinel-2 image ' +
  'before and after each one as a document. It reports the strikes with a pair, with one image ' +
  'and with none. With --list it prints the strikes and calls no service. The client of the ' +
  'Copernicus Data Space is CDSE_CLIENT_ID and CDSE_CLIENT_SECRET in the environment.';

const numberOf = (value: string | undefined): number | undefined =>
  value === undefined ? undefined : Number(value);

/** Gives 1 when the run stopped or a strike failed, and 2 for a usage fault. */
export const sentinel2PairsCommand: SubCommand = async (args) => {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      allowPositionals: false,
      strict: true,
      options: {
        list: { type: 'boolean' },
        'max-cloud': { type: 'string' },
        'half-width': { type: 'string' },
      },
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
    console.error(USAGE);
    return 2;
  }
  const maxCloud = numberOf(parsed.values['max-cloud']);
  const halfWidth = numberOf(parsed.values['half-width']);
  if (
    (maxCloud !== undefined && !(maxCloud > 0 && maxCloud <= 1)) ||
    (halfWidth !== undefined && !(halfWidth >= 500 && halfWidth <= 10_000))
  ) {
    console.error('--max-cloud is a share above 0 up to 1, and --half-width is 500 to 10000.');
    console.error(USAGE);
    return 2;
  }
  const web = webOf(process.env);
  const listing = parsed.values.list === true;
  if (!listing && (web.cdseClientId === undefined || web.cdseClientSecret === undefined)) {
    console.error(
      'CDSE_CLIENT_ID or CDSE_CLIENT_SECRET is empty or absent. Set both in the environment file.',
    );
    return 1;
  }

  const store = openStore();
  const client = new Client({ connectionString: agentAddress() });
  await client.connect();
  try {
    const { strikes, skipped } = await strikesOf(client);
    console.log(
      `${String(strikes.length)} strikes with a day and a site point; ${String(skipped)} without.`,
    );
    if (listing) {
      for (const one of strikes)
        console.log(
          `${one.ref} ${one.day}..${one.until} ${String(one.latitude)},${String(one.longitude)}`,
        );
      return 0;
    }
    const report = await pairStrikes(
      client,
      { web, store: { put: (object) => putObject(store, object) }, now: () => new Date() },
      strikes,
      {
        ...(halfWidth === undefined ? {} : { halfWidthMetres: halfWidth }),
        ...(maxCloud === undefined ? {} : { maxCloud }),
      },
    );
    // The lines hold strikes, days and scenes, never an address, a token or a client.
    console.log(
      `${String(report.pair)} with a pair, ${String(report.one)} with one image, ` +
        `${String(report.none)} with none, ${String(report.error)} with an error.`,
    );
    for (const line of report.lines) console.log(line);
    if (report.stopped !== undefined) console.error(`Stopped: ${report.stopped}`);
    return report.stopped !== undefined || report.error > 0 ? 1 : 0;
  } finally {
    await client.end();
    store.client.destroy();
  }
};
