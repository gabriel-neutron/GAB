import { setTimeout as sleepFor } from 'node:timers/promises';

import { Pool } from 'pg';

import { agentAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { makeExtractor } from './extractor/extractor.ts';
import { readExtractorConfig } from './reader-config.ts';
import { openRunner } from './runner.ts';

/** Takes the queued jobs one at a time until a stop signal. This is the one sub-command that
 * claims a job. */
export const runCommand: SubCommand = async () => {
  // A stop signal ends the wait at once and the loop after the job in hand. A job that is cut off
  // by a kill keeps its row running, and the next start of the runner puts it back in the queue.
  const stop = new AbortController();
  for (const name of ['SIGINT', 'SIGTERM'] as const) process.once(name, () => stop.abort());

  // The configuration is read at the start, so a value that is absent stops the start with its
  // name and claims nothing.
  const agents = [makeExtractor(readExtractorConfig(process.env))];

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
  return 0;
};
