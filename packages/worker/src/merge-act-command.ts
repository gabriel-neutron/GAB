import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';

const USAGE =
  'Usage: pnpm worker merge-act <duplicate> <survivor>. Two waiting acts state the same fact of ' +
  'the same author from two documents. The survivor takes the citations of the duplicate, and ' +
  'the duplicate is rejected as a duplicate.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Merges one waiting act into another through the door of the operator. The worker role holds
 * no grant on the door. It gives 1 when the door refuses, and 2 for a usage fault. */
export const mergeActCommand: SubCommand = async (args) => {
  const [duplicate, survivor, ...rest] = args;
  if (
    duplicate === undefined ||
    survivor === undefined ||
    rest.length > 0 ||
    !UUID.test(duplicate) ||
    !UUID.test(survivor)
  ) {
    console.error(USAGE);
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    await client.query("SELECT public.merge_waiting_act($1::uuid, $2::uuid, 'operator')", [
      duplicate,
      survivor,
    ]);
    console.log(`merged ${duplicate} into ${survivor}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The merge was refused.');
    return 1;
  } finally {
    await client.end();
  }
};
