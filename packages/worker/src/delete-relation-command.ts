import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';

const USAGE =
  'Usage: pnpm worker delete-relation <relation>... Each relation is a promoted relation of the ' +
  'record. The act is signed by the operator and keeps a full copy of the row. The delete is ' +
  'refused when another relation uses the relation as an end. Name a relation before the relations that use it as an end. All ids are deleted or none.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** Deletes promoted relations through the door of the operator. The worker role holds no grant on
 * the door. It gives 1 when the door refuses, and 2 for a usage fault. */
export const deleteRelationCommand: SubCommand = async (args) => {
  if (args.length === 0 || !args.every((id) => UUID.test(id))) {
    console.error(USAGE);
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  try {
    await client.connect();
    await client.query('BEGIN');
    for (const id of new Set(args))
      await client.query(
        `SELECT public.sign_change('operator', 'delete_relation', '{}'::jsonb,
           ARRAY['manual']::text[], 'relation', $1::uuid, '{}'::uuid[])`,
        [id],
      );
    await client.query('COMMIT');
    console.log(`deleted ${args.length} relation(s)`);
    return 0;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error(error instanceof Error ? error.message : 'The delete was refused.');
    return 1;
  } finally {
    await client.end();
  }
};
