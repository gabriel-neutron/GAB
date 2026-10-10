import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { requeuedLine, requeueFailedRatings } from './requeue-ratings.ts';

/** Puts each rating job that failed by a fault back in the queue as the operator role, and prints
 * the names with the reason of the earlier attempt. A job that the model refused stays failed. */
export const requeueRatingsCommand: SubCommand = async (args) => {
  if (args.length > 0) {
    console.error('Usage: pnpm worker requeue-ratings');
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    const requeued = await requeueFailedRatings(client);
    for (const one of requeued) console.log(requeuedLine(one));
    console.log(`${String(requeued.length)} failed rating jobs are back in the queue.`);
    return 0;
  } finally {
    await client.end();
  }
};
