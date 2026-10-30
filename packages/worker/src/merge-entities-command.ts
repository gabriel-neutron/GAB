import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';

const USAGE =
  'Usage: pnpm worker merge-entities <duplicate> <survivor> [--keep-name]. Two entities of one ' +
  'type are one thing. The survivor takes the relations and the values of the duplicate, and the ' +
  'duplicate resolves to the survivor. --keep-name keeps the name of the duplicate as a former ' +
  'name of the survivor. The writer door undo_merge undoes a merge.';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const KEEP_NAME = '--keep-name';

/** Merges one entity into another through the door of the operator (ADR 0014). The worker role
 * holds no grant on the door. It gives 1 when the door refuses, and 2 for a usage fault. */
export const mergeEntitiesCommand: SubCommand = async (args) => {
  const [duplicate, survivor, ...rest] = args;
  if (
    duplicate === undefined ||
    survivor === undefined ||
    rest.length > 1 ||
    (rest.length === 1 && rest[0] !== KEEP_NAME) ||
    !UUID.test(duplicate) ||
    !UUID.test(survivor)
  ) {
    console.error(USAGE);
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    await client.query('SELECT public.merge_entities($1::text, $2::uuid, $3::uuid, $4::boolean)', [
      'operator',
      survivor,
      duplicate,
      rest[0] === KEEP_NAME,
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
