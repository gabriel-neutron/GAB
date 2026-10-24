import { Client } from 'pg';

import { agentAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { runLayout } from './layout-job.ts';

/** Computes the graph layout and stores it at once. The runner also runs the layout when its queue
 * is empty and the stored layout is stale, so the operator starts this only to force a run. */
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
