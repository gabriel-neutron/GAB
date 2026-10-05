import { writeFile } from 'node:fs/promises';

import { openStore, putObject } from '@gab/store';
import { Pool } from 'pg';

import { appAddress } from './address.ts';
import { buildReport, summaryLines } from './ingest-report.ts';
import { expandPaths } from './ingest-walk.ts';
import { checkedTitle, ingestFiles, parseIngestArguments, reportLine } from './ingest.ts';

// The run writes this file in the folder where it starts, and a dry run writes it too.
const REPORT_FILE = 'ingest-report.json';

// The arguments are checked before the first read and the first write, so a run with no date or a
// wrong date stores nothing. A usage fault exits with 2, and a refused file exits with 1.
let parsed;
let files: string[];
try {
  parsed = parseIngestArguments(process.argv.slice(2));
  files = await expandPaths(parsed.paths, parsed.walk);
  checkedTitle(files, parsed.options);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
  console.error(
    'Usage: pnpm ingest <file-or-folder...> --retrieved-at <YYYY-MM-DD> [--kind file|report] ' +
      '[--title <text>] [--recursive] [--include <glob>]... [--dry-run]',
  );
  process.exit(2);
}

// This file connects to a real database at import time, so no test drives it. The tests
// cover the run that this script only starts and reports.
const store = openStore();
const pool = new Pool({ connectionString: appAddress() });
let outcomes;
try {
  outcomes = await ingestFiles(
    { connect: () => pool.connect(), put: (object) => putObject(store, object) },
    files,
    parsed.options,
  );
} finally {
  await pool.end();
}

for (const outcome of outcomes) console.log(reportLine(outcome));

const report = buildReport(outcomes, parsed.options.dryRun);
for (const line of summaryLines(report)) console.log(line);
await writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
console.log(`The report is in ${REPORT_FILE}.`);

// A refused file is a finding and not a crash, and the exit code is what a later command reads.
process.exitCode = outcomes.some((outcome) => outcome.status === 'refused') ? 1 : 0;
