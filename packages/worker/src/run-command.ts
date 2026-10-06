import { setTimeout as sleepFor } from 'node:timers/promises';

import { openStore, putObject, type RawStore } from '@gab/store';
import { endMetadata } from '@gab/tools/fetch-document';
import { webOf } from '@gab/tools/web';
import { Pool } from 'pg';

import { agentAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { makeExtractor } from './extractor/extractor.ts';
import { leadAgentOf } from './lead/lead.ts';
import { makeLoader } from './loader/loader.ts';
import { mapperAgentOf } from './mapper/mapper.ts';
import { readExtractorConfig } from './reader-config.ts';
import { openRunner } from './runner.ts';

/** Takes the queued jobs one at a time until a stop signal. This is the one sub-command that
 * claims a job. */
export const runCommand: SubCommand = async () => {
  // A stop signal ends the wait at once and the loop after the job in hand. A job that is cut off
  // by a kill keeps its row running, and the next start of the runner puts it back in the queue.
  const stop = new AbortController();
  for (const name of ['SIGINT', 'SIGTERM'] as const) process.once(name, () => stop.abort());

  // The configuration is read at the start, so a value of the extractor that is absent stops the
  // start with its name and claims nothing. A lead setting that is absent fails each lead and
  // stops no extraction.
  const stores: RawStore[] = [];
  // The loader writes one report for each load, so it opens the store when it first writes.
  const loaderStore = (): RawStore => {
    const store = openStore();
    stores.push(store);
    return store;
  };
  let reportStore: RawStore | undefined;
  const agents = [
    makeExtractor(readExtractorConfig(process.env)),
    mapperAgentOf(process.env),
    makeLoader({
      store: {
        put: (object) => {
          reportStore ??= loaderStore();
          return putObject(reportStore, object);
        },
      },
    }),
    leadAgentOf(process.env, () => {
      const store = openStore();
      stores.push(store);
      return {
        store: { put: (object) => putObject(store, object) },
        web: webOf(process.env),
        now: () => new Date(),
      };
    }),
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
    // The fetch tool keeps an exiftool process, and it holds the event loop open until it ends.
    await Promise.all([pool.end(), endMetadata()]);
    for (const store of stores) store.client.destroy();
  }
  return 0;
};
