import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { downloadObject } from '@gab/store';
import { openReadStore } from '@gab/store/bucket';
import { fileSource } from '@gab/text/zip';
import { Client } from 'pg';

import { appAddress } from './address.ts';
import type { SubCommand } from './command.ts';
import type { Extraction } from './csv-set.ts';
import { imoListOf, makeTextSet, registeredImos, type TextSetRequest } from './text-set.ts';

const USAGE =
  'Usage: pnpm worker text-set <document> (--sheet <name> | --layer <name>) ' +
  '[--where "<column>=<value>"], or pnpm worker text-set <document> --columns "<a>,<b>,..." ' +
  '[--tag "<column>=<tag>"] [--equals "<column>=<value>"] [--skip <records>] [--extract "<name>=<column>:<pattern>"] [--imo-in <file>]. Add --dry-run to count the rows and write nothing. It keeps the rows of one sheet of a stored workbook, of one GeoJSON ' +
  'layer of a stored zip archive, or of a stored CSV file with no header row (--columns names ' +
  'the columns by position, --tag keeps the rows whose cell holds that whole tag, --equals keeps the rows whose cell is that value, and it may repeat, --skip drops the first records, such as a title line and the header, --extract adds a column cut from a column by a pattern with one capture group, --imo-in reads a file of IMO numbers, one on each line, and keeps the rows whose column "imo" holds a number that the register holds as a vessel), as a named ' +
  'text set of the document, and it prints the name of the set.';

const pairOf = (text: string, option: string): { column: string; value: string } => {
  const at = text.indexOf('=');
  if (at < 1) throw new Error(`${option} is "<column>=<value>".`);
  return { column: text.slice(0, at), value: text.slice(at + 1) };
};

const extractionOf = (text: string): Extraction => {
  const equals = text.indexOf('=');
  const colon = text.indexOf(':', equals + 1);
  if (equals < 1 || colon < equals + 2 || colon === text.length - 1)
    throw new Error('--extract is "<name>=<column>:<pattern>".');
  return {
    name: text.slice(0, equals),
    from: text.slice(equals + 1, colon),
    pattern: text.slice(colon + 1),
  };
};

/** The request of the arguments, and the file of IMO numbers that the request names, if any. */
export const argsOf = (
  args: readonly string[],
): { readonly request: TextSetRequest; readonly imoIn?: string } => {
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
      extract: { type: 'string', multiple: true },
      skip: { type: 'string' },
      'imo-in': { type: 'string' },
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
    const extract = (values.extract ?? []).map(extractionOf);
    if (values.skip !== undefined && !/^\d+$/u.test(values.skip))
      throw new Error('--skip is a count of records.');
    const skip = Number(values.skip ?? 0);
    if (!Number.isInteger(skip) || skip < 0) throw new Error('--skip is a count of records.');
    if (values['imo-in'] === '') throw new Error('--imo-in is the path of a file.');
    return {
      request: {
        document,
        ...(skip === 0 ? {} : { skip }),
        columns: columns.split(',').map((name) => name.trim()),
        ...(tag === undefined ? {} : { tag }),
        ...(equals.length === 0 ? {} : { equals }),
        ...(extract.length === 0 ? {} : { extract }),
      },
      ...(values['imo-in'] === undefined ? {} : { imoIn: values['imo-in'] }),
    };
  }
  if (
    values.tag !== undefined ||
    values.equals !== undefined ||
    values.skip !== undefined ||
    values.extract !== undefined ||
    values['imo-in'] !== undefined
  )
    throw new Error('--tag, --equals, --skip, --extract and --imo-in go with --columns.');
  const filter = values.where === undefined ? undefined : pairOf(values.where, '--where');
  const base = { document, ...(filter === undefined ? {} : { filter }) };
  return {
    request:
      sheet !== undefined && sheet !== '' ? { ...base, sheet } : { ...base, layer: layer ?? '' },
  };
};

export const requestOf = (args: readonly string[]): TextSetRequest => argsOf(args).request;

/** Makes the text set of one sheet or one layer. It gives 1 when the set cannot be made, and 2 for
 * a usage fault. */
export const textSetCommand: SubCommand = async (args) => {
  let parsed: ReturnType<typeof argsOf>;
  const dryRun = args.includes('--dry-run');
  try {
    parsed = argsOf(args.filter((arg) => arg !== '--dry-run'));
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
    const { request, imoIn } = parsed;
    const imo =
      imoIn === undefined
        ? undefined
        : await registeredImos(client, imoListOf(await readFile(imoIn, 'utf8')));
    if (imo !== undefined)
      console.log(
        `${String(imo.held.length)} IMO numbers of the file are in the register as a vessel, ` +
          `${String(imo.absent.length)} are not, ${String(imo.many)} of them find more than one vessel`,
      );
    if (imo !== undefined && imo.held.length === 0)
      throw new Error('No IMO number of the file is in the register: no text set is made.');
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
      imo === undefined ? request : { ...request, imo: imo.held },
      { dryRun },
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
