import { parseArgs } from 'node:util';

import { Client } from 'pg';

import {
  buildActivityReport,
  flaresOf,
  operatorsOf,
  readAnswers,
  readAssets,
  readText,
} from './activity-report.ts';
import { agentAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { strikesOf } from './sentinel2-pairs.ts';

const USAGE =
  'Usage: pnpm worker activity-report <flare document> <text set> [--operators <document> ' +
  '<text set>]. It prints the activity mark of each asset for its kind, from the stored flare ' +
  'table, the stored FIRMS answers and the dated strikes. The operator table is optional: with ' +
  'none, a flare joins a field by name and distance only. It writes nothing to the record.';

/** Gives 2 for a usage fault. A flare for two fields is listed on the error output. */
export const activityReportCommand: SubCommand = async (args) => {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...args],
      allowPositionals: true,
      strict: true,
      options: { operators: { type: 'string' } },
    });
    if (parsed.positionals.length !== 2) throw new Error('Give the flare document and its set.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
    console.error(USAGE);
    return 2;
  }
  const [document = '', set = ''] = parsed.positionals;
  const table = parsed.values.operators;
  const client = new Client({ connectionString: agentAddress() });
  await client.connect();
  try {
    const report = buildActivityReport({
      today: new Date().toISOString().slice(0, 10),
      assets: await readAssets(client),
      flares: flaresOf(await readText(client, document, set)),
      answers: await readAnswers(client),
      strikes: (await strikesOf(client)).strikes,
      operators: table === undefined ? new Map() : operatorsOf(await readText(client, table, set)),
    });
    for (const line of report.lines) console.log(line);
    for (const line of report.review) console.error(`review: ${line}`);
    return 0;
  } finally {
    await client.end();
  }
};
