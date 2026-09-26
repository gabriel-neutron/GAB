import { openStore } from '@gab/store/bucket';
import { Client } from 'pg';

import { agentAddress } from './address.ts';
import { JOB_KIND, runOnce } from './run-once.ts';

// One process runs one kind, named on the command line: `pnpm worker:layout` or
// `pnpm worker:reconcile`. The job row carries no kind column, so nothing but the process itself
// says which runner a claimed job takes.
const kind = JOB_KIND.safeParse(process.argv[2]);
if (!kind.success) {
  console.error("Name the job kind on the command line: 'layout' or 'reconcile'.");
  process.exitCode = 1;
} else {
  const client = new Client({ connectionString: agentAddress() });
  await client.connect();
  try {
    const report = await runOnce(kind.data, client, openStore);
    console.log(report ?? 'The queue holds no job today.');
  } finally {
    await client.end();
  }
}
