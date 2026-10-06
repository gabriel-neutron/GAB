import { setTimeout as sleepFor } from 'node:timers/promises';

import { Pool } from 'pg';

import { agentAddress } from './address.ts';
import { makeEvidenceAgent } from './evidence/evidence.ts';
import { makeExtractor } from './extractor/extractor.ts';
import { READER_MINIMISER } from './minimise.ts';
import { readReader2, readReaderConfig } from './reader-config.ts';
import { makeReader2 } from './reader2/reader2.ts';
import { openRunner } from './runner.ts';

// A stop signal ends the wait at once and the loop after the job in hand. A job that is cut off
// by a kill keeps its row running, and the end of its lease returns it to the queue.
const stop = new AbortController();
for (const name of ['SIGINT', 'SIGTERM'] as const) process.once(name, () => stop.abort());

// The list is built at the start, so a value that is absent stops the start with its name and
// claims nothing. Both readers run the minimiser, and no task of a reader needs a personal key.
// The checks ask no model, so they need no value.
const extractor = readReaderConfig('EXTRACTOR', process.env);
const second = readReader2(process.env, extractor);
const agents = [
  makeExtractor(extractor, { minimise: READER_MINIMISER }),
  makeReader2(second, { minimise: READER_MINIMISER }),
  makeEvidenceAgent(),
];

const pool = new Pool({ connectionString: agentAddress() });
try {
  const runner = await openRunner({
    db: pool,
    agents,
    sleep: (ms) => sleepFor(ms, undefined, { signal: stop.signal }).catch(() => undefined),
    now: () => performance.now(),
  });
  await runner.run(stop.signal);
} finally {
  await pool.end();
}
