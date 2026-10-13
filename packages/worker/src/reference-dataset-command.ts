import { parseArgs } from 'node:util';

import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import type { Queryable } from './queryable.ts';

const USAGE =
  'Usage: pnpm worker reference-dataset approve <document> --name <dataset>. It approves one ' +
  'stored edition of one named dataset as a reference dataset. The approval is written once.';

/** The document and the name of an approval, or a sentence for a wrong command line. */
export const parseApproval = (
  args: readonly string[],
): { readonly document: string; readonly name: string } => {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    strict: true,
    options: { name: { type: 'string' } },
  });
  const [verb, document, ...rest] = positionals;
  if (verb !== 'approve' || document === undefined || rest.length > 0)
    throw new Error('Say "approve" and name one document.');
  if (values.name === undefined || values.name.trim() === '')
    throw new Error('--name is required.');
  return { document, name: values.name.trim() };
};

/** Approves the edition through the door of the operator. It answers false when the same
 * approval is written already. */
export const approveReferenceDataset = async (
  db: Queryable,
  document: string,
  name: string,
): Promise<boolean> => {
  const { rows } = await db.query('SELECT public.approve_reference_dataset($1, $2) AS done', [
    document,
    name,
  ]);
  return (rows[0] as { done: boolean }).done;
};

/** Approves one edition as a reference dataset. It runs as the operator role, and the worker role
 * holds no grant on the door. It gives 1 when the door refuses, and 2 for a usage fault. */
export const referenceDatasetCommand: SubCommand = async (args) => {
  let request;
  try {
    request = parseApproval(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
    console.error(USAGE);
    return 2;
  }
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    const done = await approveReferenceDataset(client, request.document, request.name);
    console.log(
      done
        ? `approved ${request.document} as the reference dataset ${request.name}`
        : `${request.document} is approved already as ${request.name}`,
    );
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The approval was refused.');
    return 1;
  } finally {
    await client.end();
  }
};
