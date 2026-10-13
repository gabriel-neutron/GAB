import { Client } from 'pg';

import { agentAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { dryJoin } from './loader/dry-join.ts';

const USAGE =
  'Usage: pnpm worker dry-join <mapping>. It writes to the standard output, for each row of the ' +
  'table of the mapping, the key that finds its entity in the record, or that the row creates ' +
  'one. It writes nothing in the record.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** The dry join of one mapping, before its load. It gives 1 when the join fails, and 2 for a
 * usage fault. */
export const dryJoinCommand: SubCommand = async (args) => {
  const [mapping, ...rest] = args;
  if (mapping === undefined || rest.length > 0 || !UUID.test(mapping)) {
    console.error('Name one mapping by its identifier.');
    console.error(USAGE);
    return 2;
  }
  const client = new Client({ connectionString: agentAddress() });
  await client.connect();
  try {
    process.stdout.write(await dryJoin(client, mapping));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The dry join failed.');
    return 1;
  } finally {
    await client.end();
  }
};
