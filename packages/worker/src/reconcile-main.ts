import { openStore } from '@gab/store/bucket';
import { Client } from 'pg';

import { agentAddress } from './address.ts';
import { reconcileCorpus } from './reconcile.ts';

// A corpus-wide alarm belongs to the operator and not to the queue, so this run is taken by hand
// and never as a job row. It reports, and it repairs nothing: a silent repair hides the fault
// that caused the mismatch.
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

// This file connects to a real database at import time, so no test drives it; reconcile.test.ts
// covers the set-difference logic that this script only prints and exits on.
const total = found.objectsWithNoRow.length + found.rowsWithNoObject.length;
console.log(
  total === 0
    ? 'The bucket and the index agree.'
    : `The bucket and the index disagree on ${String(total)} names.`,
);

// A mismatch is a finding and not a crash, and the exit code is what a later command reads.
process.exitCode = total === 0 ? 0 : 1;
