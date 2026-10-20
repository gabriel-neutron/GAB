import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { relabelDocuments, reportLines } from './document-labels.ts';

const USAGE = 'Usage: pnpm worker document-labels [--dry-run]';

/** Gives a readable title and a type to each stored document that lacks them, and lists the
 * stored search pages. It deletes nothing. It gives 2 for a usage fault. */
export const documentLabelsCommand: SubCommand = async (args) => {
  const unknown = args.filter((word) => word !== '--dry-run');
  if (unknown.length > 0) {
    console.error(`"${unknown.join(' ')}" is not an argument of document-labels.`);
    console.error(USAGE);
    return 2;
  }

  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  let report;
  try {
    report = await relabelDocuments(client, args.includes('--dry-run'));
  } finally {
    await client.end();
  }

  for (const line of reportLines(report)) console.log(line);
  return 0;
};
