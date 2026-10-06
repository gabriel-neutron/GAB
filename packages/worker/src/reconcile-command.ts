import { openStore } from '@gab/store/bucket';
import { Client } from 'pg';

import { agentAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { reconcileCorpus } from './reconcile.ts';

/** Compares the bucket and the document index, and gives 1 when they disagree. It repairs
 * nothing: a silent repair hides the fault that caused the mismatch. */
export const reconcileCommand: SubCommand = async () => {
  const client = new Client({ connectionString: agentAddress() });
  await client.connect();
  let found;
  try {
    found = await reconcileCorpus(client, openStore());
  } finally {
    await client.end();
  }

  for (const key of found.objectsWithNoRow) console.log(`object with no row: ${key}`);
  for (const row of found.rowsWithNoObject)
    console.log(`row with no object: document ${row.documentId} cites ${row.key}`);

  const total = found.objectsWithNoRow.length + found.rowsWithNoObject.length;
  console.log(
    total === 0
      ? 'The bucket and the index agree.'
      : `The bucket and the index disagree on ${String(total)} names.`,
  );
  return total === 0 ? 0 : 1;
};
