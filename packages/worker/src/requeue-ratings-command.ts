import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { requeueFailedRatings } from './requeue-ratings.ts';

/** Puts each failed rating job back in the queue as the operator role, and prints the names. */
export const requeueRatingsCommand: SubCommand = async (args) => {
  if (args.length > 0) {
    console.error('Usage: pnpm worker requeue-ratings');
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    const names = await requeueFailedRatings(client);
    for (const name of names) console.log(name);
    console.log(`${String(names.length)} failed rating jobs are back in the queue.`);
    return 0;
  } finally {
    await client.end();
  }
};
