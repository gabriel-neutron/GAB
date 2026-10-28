import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';

const USAGE =
  'Usage: pnpm worker undo-merge <absorbed>. The absorbed entity of a merge comes back as it was, ' +
  'with its relations. The survivor loses the values it took from it.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Undoes the last merge of one entity through the door of the operator (ADR 0014). It gives 1
 * when the door refuses, and 2 for a usage fault. */
export const undoMergeCommand: SubCommand = async (args) => {
  const [absorbed, ...rest] = args;
  if (absorbed === undefined || rest.length > 0 || !UUID.test(absorbed)) {
    console.error(USAGE);
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    await client.query('SELECT public.undo_merge($1::text, $2::uuid)', ['operator', absorbed]);
    console.log(`undid the merge of ${absorbed}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The undo was refused.');
    return 1;
  } finally {
    await client.end();
  }
};
