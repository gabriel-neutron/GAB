import { openStore, putObject } from '@gab/store';
import { Pool } from 'pg';

import { appAddress } from './address.ts';
import { ingestFiles, parseIngestArguments, reportLine } from './ingest.ts';

// The arguments are checked before the first read and the first write, so a run with no date or a
// wrong date stores nothing. A usage fault exits with 2, and a refused file exits with 1.
let parsed;
try {
  parsed = parseIngestArguments(process.argv.slice(2), new Date());
} catch (error) {
  console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
  console.error(
    'Usage: pnpm ingest <path...> --retrieved-at <YYYY-MM-DD> [--kind file|report] [--title <text>]',
  );
  process.exit(2);
}

// This file connects to a real database at import time, so no test drives it; ingest.test.ts and
// ingest.db-test.ts cover the run that this script only starts and reports.
const store = openStore();
const pool = new Pool({ connectionString: appAddress() });
let outcomes;
try {
  outcomes = await ingestFiles(
    { connect: () => pool.connect(), put: (object) => putObject(store, object) },
    parsed.paths,
    parsed.options,
  );
} finally {
  await pool.end();
}

for (const outcome of outcomes) console.log(reportLine(outcome));

// A refused file is a finding and not a crash, and the exit code is what a later command reads.
process.exitCode = outcomes.some((outcome) => outcome.status === 'refused') ? 1 : 0;
