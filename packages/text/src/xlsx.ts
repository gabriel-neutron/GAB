// The tables of an XLSX workbook, as CSV text. The function is pure: it reads no database and no
// object store. A workbook is a zip archive of XML parts, and node:zlib reads the archive, so no
// dependency is added. A sheet becomes one CSV page, and a named text set keeps the rows of one
// sheet that hold one value in one column. The same bytes and the same filter always give the
// same text, so a third party can read the same rows (decisions.md S2, ADR 0012).

import { inflateRawSync } from 'node:zlib';

/** The type of an XLSX workbook. */
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The version of the reader. It is in the name of each text set, so a better reader writes a new
 * set beside the old one and no citation of the old set moves. */
export const TABLE_READER = 'xlsx-1';

/** A workbook that code cannot read as tables. */
export class WorkbookFault extends Error {
  constructor(reason: string, options?: ErrorOptions) {
    super(reason, options);
    this.name = 'WorkbookFault';
  }
}

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_ENTRY = 0x04034b50;
const STORED = 0;
const DEFLATED = 8;
const LOOKBACK = 22 + 0xffff;

/** The most bytes that one part of a workbook may inflate to. A small archive can hold a part of
 * many gigabytes (a zip bomb), and the reader holds one part in memory. */
export const MAX_PART_BYTES = 128 * 1024 * 1024;

const inflated = (raw: Uint8Array, name: string): Uint8Array => {
  try {
    return inflateRawSync(raw, { maxOutputLength: MAX_PART_BYTES });
  } catch (fault) {
    throw new WorkbookFault(
      `the part ${name} of the zip archive inflates to more than ${String(MAX_PART_BYTES)} bytes, or is broken`,
      { cause: fault },
    );
  }
};

// shortcut: a zip64 archive (4 GiB or 65,535 parts) is refused, upgrade when a file needs it.
const parts = (bytes: Uint8Array): Map<string, () => string> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = bytes.length - 22;
  while (
    end >= 0 &&
    end >= bytes.length - LOOKBACK &&
    view.getUint32(end, true) !== END_OF_DIRECTORY
  )
    end -= 1;
  if (end < 0 || view.getUint32(end, true) !== END_OF_DIRECTORY)
    throw new WorkbookFault('the file is no zip archive, so it is no XLSX workbook');
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const found = new Map<string, () => string>();
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== DIRECTORY_ENTRY)
      throw new WorkbookFault('the directory of the zip archive is broken');
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const local = view.getUint32(at + 42, true);
    const nameLength = view.getUint16(at + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    found.set(name, () => {
      if (local + 30 > bytes.length || view.getUint32(local, true) !== LOCAL_ENTRY)
        throw new WorkbookFault(`the part ${name} of the zip archive is broken`);
      const from = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const raw = bytes.subarray(from, from + size);
      if (method === STORED) return new TextDecoder().decode(raw);
      if (method === DEFLATED) return new TextDecoder().decode(inflated(raw, name));
      throw new WorkbookFault(`the part ${name} uses the zip method ${String(method)}`);
    });
  }
  return found;
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
export const sheetNames = (bytes: Uint8Array): string[] => {
  const zip = parts(bytes);
  const book = zip.get('xl/workbook.xml')?.();
  if (book === undefined) throw new WorkbookFault('the archive holds no xl/workbook.xml part');
  return [...book.matchAll(/<sheet\b[^>]*>/gu)].map((one) => attribute(one[0], 'name') ?? '');
};

const sheetPart = (zip: Map<string, () => string>, sheet: string): string => {
  const book = zip.get('xl/workbook.xml')?.() ?? '';
  const tag = [...book.matchAll(/<sheet\b[^>]*>/gu)]
    .map((one) => one[0])
    .find((one) => attribute(one, 'name') === sheet);
  if (tag === undefined) throw new WorkbookFault(`the workbook has no sheet named "${sheet}"`);
  const id = attribute(tag, 'r:id');
  const relations = zip.get('xl/_rels/workbook.xml.rels')?.() ?? '';
  const target = [...relations.matchAll(/<Relationship\b[^>]*>/gu)]
    .map((one) => one[0])
    .find((one) => attribute(one, 'Id') === id);
  const path = target === undefined ? undefined : attribute(target, 'Target');
  if (path === undefined) throw new WorkbookFault(`the sheet "${sheet}" names no part`);
  return path.startsWith('/') ? path.slice(1) : `xl/${path}`;
};

// "AB12" is the column 27 (counted from 0).
const columnOf = (reference: string): number => {
  let column = 0;
  for (const letter of /^[A-Z]+/u.exec(reference)?.[0] ?? 'A')
    column = column * 26 + letter.charCodeAt(0) - 64;
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

/** The rows of one sheet, each as a list of cell texts. A row with no cell that holds text is
 * left out. A number keeps the text that the workbook stores. */
export const sheetRows = (bytes: Uint8Array, sheet: string): string[][] => {
  const zip = parts(bytes);
  const name = sheetPart(zip, sheet);
  const xml = zip.get(name)?.();
  if (xml === undefined) throw new WorkbookFault(`the part ${name} of the sheet is missing`);
  const strings = sharedStrings(zip.get('xl/sharedStrings.xml')?.());
  const rows: string[][] = [];
  for (const row of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/gu)) {
    const cells: (string | undefined)[] = [];
    for (const cell of (row[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gu)) {
      const tag = cell[1] ?? '';
      const at = columnOf(attribute(tag, 'r') ?? '');
      cells[at] = cellText(tag, cell[2] ?? '', strings);
    }
    const filled = Array.from(cells, (text) => text ?? '');
    if (filled.some((text) => text.trim() !== '')) rows.push(filled);
  }
  return rows;
};

const csvField = (text: string): string =>
  /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;

const csvOf = (rows: readonly (readonly string[])[]): string =>
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

/** One sheet as CSV text: the header row, then each row that the filter keeps. A row is padded or
 * cut to the width of the header, and a trailing column with no name is dropped. */
export const sheetCsv = (bytes: Uint8Array, sheet: string, filter?: TableFilter): string => {
  const [first, ...rows] = sheetRows(bytes, sheet);
  if (first === undefined) throw new WorkbookFault(`the sheet "${sheet}" holds no row`);
  const header = first.map((name) => name.trim());
  while (header.at(-1) === '') header.pop();
  const at = filter === undefined ? -1 : header.indexOf(filter.column);
  if (filter !== undefined && at === -1)
    throw new WorkbookFault(`the sheet "${sheet}" has no column "${filter.column}"`);
  const kept = rows
    .filter((row) => filter === undefined || (row[at] ?? '').trim() === filter.value)
    .map((row) => Array.from({ length: header.length }, (_, index) => row[index] ?? ''));
  return csvOf([header, ...kept]);
};
