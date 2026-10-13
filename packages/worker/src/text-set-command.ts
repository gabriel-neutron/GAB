import { parseArgs } from 'node:util';

import { openReadStore } from '@gab/store/bucket';
import { readObject } from '@gab/store/reading';
import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { makeTextSet } from './text-set.ts';

const USAGE =
  'Usage: pnpm worker text-set <document> --sheet <name> [--where "<column>=<value>"]. It keeps ' +
  'the rows of one sheet of a stored workbook as a named text set of the document, and it ' +
  'prints the name of the set.';

/** Makes the text set of one sheet. It gives 1 when the set cannot be made, and 2 for a usage
 * fault. */
export const textSetCommand: SubCommand = async (args) => {
  let document: string;
  let sheet: string;
  let filter: { column: string; value: string } | undefined;
  try {
    const { values, positionals } = parseArgs({
      args: [...args],
      allowPositionals: true,
      strict: true,
      options: { sheet: { type: 'string' }, where: { type: 'string' } },
    });
    if (positionals.length !== 1 || positionals[0] === undefined)
      throw new Error('Name one document.');
    if (values.sheet === undefined || values.sheet === '') throw new Error('--sheet is required.');
    document = positionals[0];
    sheet = values.sheet;
    if (values.where !== undefined) {
      const at = values.where.indexOf('=');
      if (at < 1) throw new Error('--where is "<column>=<value>".');
      filter = { column: values.where.slice(0, at), value: values.where.slice(at + 1) };
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
    console.error(USAGE);
    return 2;
  }

  const store = openReadStore();
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  try {
    const made = await makeTextSet(
      { db: client, read: (key) => readObject(store, key) },
      { document, sheet, ...(filter === undefined ? {} : { filter }) },
    );
    console.log(
      `${made.status} the text set ${made.name} of ${document}: ${String(made.rows)} rows`,
    );
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The text set was not made.');
    return 1;
  } finally {
    await client.end();
    store.client.destroy();
  }
};
