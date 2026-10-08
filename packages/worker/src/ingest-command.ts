import { writeFile } from 'node:fs/promises';

import { openStore, putObject } from '@gab/store';
import { endOcr } from '@gab/text';
import { Pool } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { buildReport, summaryLines } from './ingest-report.ts';
import { expandPaths } from './ingest-walk.ts';
import { checkedTitle, ingestFiles, parseIngestArguments, reportLine } from './ingest.ts';

// The run writes this file in the folder where it starts, and a dry run writes it too.
const REPORT_FILE = 'ingest-report.json';

const USAGE =
  'Usage: pnpm worker ingest <file-or-folder...> --retrieved-at <YYYY-MM-DD> ' +
  '[--kind file|report] [--title <text>] [--recursive] [--include <glob>]... [--dry-run]';

/** Stores the files that the words name. A usage fault gives 2, and a refused file gives 1. */
export const ingestCommand: SubCommand = async (args) => {
  // The arguments are checked before the first read and the first write, so a run with no date
  // or a wrong date stores nothing.
  let parsed;
  let files: string[];
  try {
    parsed = parseIngestArguments(args);
    files = await expandPaths(parsed.paths, parsed.walk);
    checkedTitle(files, parsed.options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
    console.error(USAGE);
    return 2;
  }

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
    // The OCR thread of an image holds the event loop open until it ends.
    await Promise.all([pool.end(), endOcr()]);
  }

  for (const outcome of outcomes) console.log(reportLine(outcome));

  const report = buildReport(outcomes, parsed.options.dryRun);
  for (const line of summaryLines(report)) console.log(line);
  await writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`The report is in ${REPORT_FILE}.`);

  // A refused file is a finding and not a crash, and the exit code is what a later command reads.
  return outcomes.some((outcome) => outcome.status === 'refused') ? 1 : 0;
};
