import { openReadStore } from '@gab/store/bucket';
import { readObject } from '@gab/store/reading';
import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { rereadHtml, reportLines } from './reread.ts';

const USAGE = 'Usage: pnpm worker reread-html [--dry-run]';

/** Reads the text and the title of each stored HTML document again from its bytes, and corrects
 * them when they change. It gives 1 when a document could not be read, and 2 for a usage fault. */
export const rereadCommand: SubCommand = async (args) => {
  const unknown = args.filter((word) => word !== '--dry-run');
  if (unknown.length > 0) {
    console.error(`"${unknown.join(' ')}" is not an argument of reread-html.`);
    console.error(USAGE);
    return 2;
  }

  const store = openReadStore();
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  let report;
  try {
    report = await rereadHtml(
      { db: client, read: (key) => readObject(store, key), now: () => new Date() },
      args.includes('--dry-run'),
    );
  } finally {
    await client.end();
    store.client.destroy();
  }

  for (const line of reportLines(report)) console.log(line);
  return report.failed.length === 0 ? 0 : 1;
};
