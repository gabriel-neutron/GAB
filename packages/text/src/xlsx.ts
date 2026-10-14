// The tables of an XLSX workbook, as CSV text. The function is pure: it reads no database and no
// object store. A workbook is a zip archive of XML parts, and node:zlib reads the archive, so no
// dependency is added. A sheet becomes one CSV page, and a named text set keeps the rows of one
// sheet that hold one value in one column. The same bytes and the same filter always give the
// same text, so a third party can read the same rows (decisions.md S2, ADR 0012).

import { StringDecoder } from 'node:string_decoder';

import {
  bytesSource,
  partChunks,
  partText,
  WorkbookFault,
  zipEntries,
  type ZipEntry,
  type ZipSource,
} from './zip.ts';

export { MAX_PART_BYTES, WorkbookFault } from './zip.ts';

/** The type of an XLSX workbook. */
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The version of the reader. It is in the name of each text set, so a better reader writes a new
 * set beside the old one and no citation of the old set moves. */
export const TABLE_READER = 'xlsx-1';

/** The bytes of an archive, or a source that reads them at an offset. */
export type TableInput = Uint8Array | ZipSource;

/** The archive of an input, with its parts. */
export interface Archive {
  readonly source: ZipSource;
  readonly entries: Map<string, ZipEntry>;
}

export const openArchive = async (input: TableInput): Promise<Archive> => {
  const source = input instanceof Uint8Array ? bytesSource(input) : input;
  return { source, entries: await zipEntries(source) };
};

const textOf = async (archive: Archive, name: string): Promise<string | undefined> => {
  const entry = archive.entries.get(name);
  return entry === undefined ? undefined : partText(archive.source, entry);
};

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

const LAST_CODE_POINT = 0x10ffff;

const decoded = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (whole, name: string) => {
    if (name.startsWith('#')) {
      const hex = name[1] === 'x' || name[1] === 'X';
      const point = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return point <= LAST_CODE_POINT ? String.fromCodePoint(point) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });

const attribute = (tag: string, name: string): string | undefined => {
  const found = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'u').exec(tag);
  const value = found?.[1] ?? found?.[2];
  return value === undefined ? undefined : decoded(value);
};

// The text runs of one string item. A phonetic run (rPh) is a reading aid and not the text.
const runsOf = (item: string): string =>
  [...item.replaceAll(/<rPh\b[\s\S]*?<\/rPh>/gu, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gu)]
    .map((one) => decoded(one[1] ?? ''))
    .join('');

const sharedStrings = (xml: string | undefined): string[] =>
  xml === undefined
    ? []
    : [...xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/gu)].map((one) =>
        runsOf(one[1] ?? ''),
      );

/** The names of the sheets of a workbook, in the order of the workbook. */
export const sheetNames = async (input: TableInput): Promise<string[]> => {
  const book = await textOf(await openArchive(input), 'xl/workbook.xml');
  if (book === undefined) throw new WorkbookFault('the archive holds no xl/workbook.xml part');
  return [...book.matchAll(/<sheet\b[^>]*>/gu)].map((one) => attribute(one[0], 'name') ?? '');
};

const sheetPart = async (archive: Archive, sheet: string): Promise<string> => {
  const book = (await textOf(archive, 'xl/workbook.xml')) ?? '';
  const tag = [...book.matchAll(/<sheet\b[^>]*>/gu)]
    .map((one) => one[0])
    .find((one) => attribute(one, 'name') === sheet);
  if (tag === undefined) throw new WorkbookFault(`the workbook has no sheet named "${sheet}"`);
  const id = attribute(tag, 'r:id');
  const relations = (await textOf(archive, 'xl/_rels/workbook.xml.rels')) ?? '';
  const target = [...relations.matchAll(/<Relationship\b[^>]*>/gu)]
    .map((one) => one[0])
    .find((one) => attribute(one, 'Id') === id);
  const path = target === undefined ? undefined : attribute(target, 'Target');
  if (path === undefined) throw new WorkbookFault(`the sheet "${sheet}" names no part`);
  return path.startsWith('/') ? path.slice(1) : `xl/${path}`;
};

// External constraint: a sheet of the XLSX format holds at most 16,384 columns, A to XFD.
const LAST_COLUMN = 16_383;

// "AB" is the column 27 (counted from 0).
const columnOf = (letters: string): number => {
  let column = 0;
  for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64;
  return column - 1;
};

const cellText = (tag: string, body: string, strings: readonly string[]): string => {
  const type = attribute(tag, 't') ?? 'n';
  const value = /<v\b[^>]*>([\s\S]*?)<\/v>/u.exec(body)?.[1];
  if (type === 'inlineStr') return runsOf(body);
  if (value === undefined) return '';
  if (type === 's') return strings[Number(value)] ?? '';
  if (type === 'b') return value.trim() === '1' ? 'TRUE' : 'FALSE';
  if (type === 'e') return '';
  return decoded(value);
};

// The rows of one sheet, read from the inflated stream. The buffer holds the text from the first
// row that is not complete, so the memory is one row and one chunk, and never the sheet.
const ROW = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/gu;

async function* sheetRows(
  archive: Archive,
  sheet: string,
  strings: readonly string[],
): AsyncGenerator<string[]> {
  const name = await sheetPart(archive, sheet);
  const entry = archive.entries.get(name);
  if (entry === undefined) throw new WorkbookFault(`the part ${name} of the sheet is missing`);
  const decoder = new StringDecoder('utf8');
  let held = '';
  const drain = function* (): Generator<string[]> {
    ROW.lastIndex = 0;
    let used = 0;
    for (let row = ROW.exec(held); row !== null; row = ROW.exec(held)) {
      used = ROW.lastIndex;
      const cells: (string | undefined)[] = [];
      // A cell with no reference takes the column after the previous cell.
      let next = 0;
      for (const cell of (row[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu)) {
        const tag = cell[1] ?? '';
        const reference = attribute(tag, 'r');
        const letters = /^[A-Z]+/u.exec(reference ?? '')?.[0];
        // The length test stops a reference of many letters before the loop makes a float.
        if (letters !== undefined && (letters.length > 3 || columnOf(letters) > LAST_COLUMN))
          throw new WorkbookFault(
            `the cell ${reference ?? ''} stands after the last column XFD of a sheet`,
          );
        const column = letters === undefined ? next : columnOf(letters);
        cells[column] = cellText(tag, cell[2] ?? '', strings);
        next = column + 1;
      }
      const filled = Array.from(cells, (text) => text ?? '');
      if (filled.some((text) => text.trim() !== '')) yield filled;
    }
    const open = held.lastIndexOf('<row', held.length);
    held = open >= used ? held.slice(open) : held.slice(Math.max(used, held.length - 4));
  };
  for await (const chunk of partChunks(archive.source, entry)) {
    held += decoder.write(chunk);
    yield* drain();
  }
  held += decoder.end();
  yield* drain();
}

/** One field of a CSV row, with the quotes of RFC 4180. */
export const csvField = (text: string): string =>
  /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;

export const csvOf = (rows: readonly (readonly string[])[]): string =>
  rows.map((row) => `${row.map(csvField).join(',')}\r\n`).join('');

/** One column filter of a text set: the rows that hold exactly this value in this column. */
export interface TableFilter {
  readonly column: string;
  readonly value: string;
}

/** The name of a text set. The same sheet and the same filter give the same name, and the name
 * holds the version of the reader. */
export const textSetName = (sheet: string, filter?: TableFilter): string =>
  `${TABLE_READER}|sheet=${sheet}` +
  (filter === undefined ? '' : `|where=${filter.column}=${filter.value}`);

/** The most characters of CSV text that one table read keeps. A read with no filter and no row
 * limit keeps every row, so a large sheet would fill the memory without this cap. */
export const MAX_TABLE_CHARS = 64 * 1024 * 1024;

/** The CSV rows of one table, with the cap of the kept text. */
export class KeptRows {
  private readonly rows: string[] = [];
  private chars = 0;

  add(row: readonly string[], table: string): void {
    const line = csvOf([row]);
    this.chars += line.length;
    if (this.chars > MAX_TABLE_CHARS)
      throw new WorkbookFault(
        `the table ${table} keeps more than ${String(MAX_TABLE_CHARS)} characters: give a filter`,
      );
    this.rows.push(line);
  }

  get length(): number {
    return this.rows.length;
  }

  text(): string {
    return this.rows.join('');
  }
}

const sheetCsvOf = async (
  archive: Archive,
  strings: readonly string[],
  sheet: string,
  filter?: TableFilter,
  maxRows?: number,
): Promise<string> => {
  let header: string[] | undefined;
  let at = -1;
  const kept = new KeptRows();
  for await (const row of sheetRows(archive, sheet, strings)) {
    if (header === undefined) {
      header = row.map((name) => name.trim());
      while (header.at(-1) === '') header.pop();
      at = filter === undefined ? -1 : header.indexOf(filter.column);
      if (filter !== undefined && at === -1)
        throw new WorkbookFault(`the sheet "${sheet}" has no column "${filter.column}"`);
      continue;
    }
    if (filter !== undefined && (row[at] ?? '').trim() !== filter.value) continue;
    const width = header.length;
    kept.add(
      Array.from({ length: width }, (_, index) => row[index] ?? ''),
      `sheet "${sheet}"`,
    );
    if (maxRows !== undefined && kept.length >= maxRows) break;
  }
  if (header === undefined) throw new WorkbookFault(`the sheet "${sheet}" holds no row`);
  return csvOf([header]) + kept.text();
};

/** One sheet as CSV text: the header row, then each row that the filter keeps. A row is padded or
 * cut to the width of the header, and a trailing column with no name is dropped. The sheet is
 * read as a stream. The memory is the table of shared strings of the workbook, one chunk, and the
 * rows that are kept (at most MAX_TABLE_CHARS). `maxRows` stops the read after that many kept
 * rows. */
export const sheetCsv = async (
  input: TableInput,
  sheet: string,
  filter?: TableFilter,
  maxRows?: number,
): Promise<string> => {
  const archive = await openArchive(input);
  const strings = sharedStrings(await textOf(archive, 'xl/sharedStrings.xml'));
  return sheetCsvOf(archive, strings, sheet, filter, maxRows);
};

/** Every sheet of a workbook as CSV text, in the order of the workbook. The shared strings are
 * read once for the whole workbook. */
export const workbookCsvs = async (input: TableInput, maxRows?: number): Promise<string[]> => {
  const archive = await openArchive(input);
  const strings = sharedStrings(await textOf(archive, 'xl/sharedStrings.xml'));
  const pages: string[] = [];
  for (const sheet of await sheetNames(archive.source))
    pages.push(await sheetCsvOf(archive, strings, sheet, undefined, maxRows));
  return pages;
};
