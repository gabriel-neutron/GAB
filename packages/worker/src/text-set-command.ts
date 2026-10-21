import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { downloadObject } from '@gab/store';
import { openReadStore } from '@gab/store/bucket';
import { fileSource } from '@gab/text/zip';
import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import { makeTextSet, type TextSetRequest } from './text-set.ts';

const USAGE =
  'Usage: pnpm worker text-set <document> (--sheet <name> | --layer <name>) ' +
  '[--where "<column>=<value>"], or pnpm worker text-set <document> --columns "<a>,<b>,..." ' +
  '[--tag "<column>=<tag>"] [--equals "<column>=<value>"]. It keeps the rows of one sheet of a stored workbook, of one GeoJSON ' +
  'layer of a stored zip archive, or of a stored CSV file with no header row (--columns names ' +
  'the columns by position, --tag keeps the rows whose cell holds that whole tag, --equals keeps the rows whose cell is that value, and it may repeat), as a named ' +
  'text set of the document, and it prints the name of the set.';

const pairOf = (text: string, option: string): { column: string; value: string } => {
  const at = text.indexOf('=');
  if (at < 1) throw new Error(`${option} is "<column>=<value>".`);
  return { column: text.slice(0, at), value: text.slice(at + 1) };
};

const requestOf = (args: readonly string[]): TextSetRequest => {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    strict: true,
    options: {
      sheet: { type: 'string' },
      layer: { type: 'string' },
      where: { type: 'string' },
      columns: { type: 'string' },
      tag: { type: 'string' },
      equals: { type: 'string', multiple: true },
    },
  });
  const [document] = positionals;
  if (positionals.length !== 1 || document === undefined) throw new Error('Name one document.');
  const { sheet, layer, columns } = values;
  const given = [sheet, layer, columns].filter((value) => value !== undefined && value !== '');
  if (given.length !== 1) throw new Error('Give --sheet, --layer or --columns, and only one.');
  if (columns !== undefined && columns !== '') {
    if (values.where !== undefined) throw new Error('Use --tag, and not --where, with --columns.');
    const tag = values.tag === undefined ? undefined : pairOf(values.tag, '--tag');
    const equals = (values.equals ?? []).map((pair) => pairOf(pair, '--equals'));
    return {
      document,
      columns: columns.split(',').map((name) => name.trim()),
      ...(tag === undefined ? {} : { tag }),
      ...(equals.length === 0 ? {} : { equals }),
    };
  }
  if (values.tag !== undefined || values.equals !== undefined)
    throw new Error('--tag and --equals go with --columns.');
  const filter = values.where === undefined ? undefined : pairOf(values.where, '--where');
  const base = { document, ...(filter === undefined ? {} : { filter }) };
  return sheet !== undefined && sheet !== '' ? { ...base, sheet } : { ...base, layer: layer ?? '' };
};

/** Makes the text set of one sheet or one layer. It gives 1 when the set cannot be made, and 2 for
 * a usage fault. */
export const textSetCommand: SubCommand = async (args) => {
  let request: TextSetRequest;
  try {
    request = requestOf(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The arguments are not usable.');
    console.error(USAGE);
    return 2;
  }

  const store = openReadStore();
  const client = new Client({ connectionString: appAddress() });
  await client.connect();
  const folder = await mkdtemp(join(tmpdir(), 'gab-text-set-'));
  try {
    const made = await makeTextSet(
      {
        db: client,
        // The object goes to a file first, and the reader asks the file for the bytes that it
        // needs, so a large file is never held in memory.
        open: async (key) => {
          const path = join(folder, 'object');
          await downloadObject(store, key, path);
          return fileSource(path);
        },
      },
      request,
    );
    console.log(
      `${made.status} the text set ${made.name} of ${request.document}: ${String(made.rows)} rows`,
    );
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The text set was not made.');
    return 1;
  } finally {
    await client.end();
    store.client.destroy();
    await rm(folder, { recursive: true, force: true });
  }
};
