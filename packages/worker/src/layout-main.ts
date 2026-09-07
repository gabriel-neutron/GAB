import { Client } from 'pg';

import { agentAddress } from './address.ts';
import { runLayout } from './layout-job.ts';

// The run is taken by hand: the corpus moves when the operator promotes, and nothing else moves
// it, so this stands beside a batch of promotions and never on a clock.
const client = new Client({ connectionString: agentAddress() });
await client.connect();
try {
  const placed = await runLayout(client);
  console.log(`The layout run placed ${String(placed)} entities.`);
} finally {
  await client.end();
}
