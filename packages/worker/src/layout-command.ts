import { Client } from 'pg';

import { agentAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { runLayout } from './layout-job.ts';

/** Computes the graph layout and stores it. The corpus moves only when the operator promotes, so
 * the operator starts this after a batch of promotions, and no clock starts it. */
export const layoutCommand: SubCommand = async () => {
  const client = new Client({ connectionString: agentAddress() });
  await client.connect();
  try {
    const placed = await runLayout(client);
    console.log(`The layout run placed ${String(placed)} entities.`);
  } finally {
    await client.end();
  }
  return 0;
};
