import { csvOf, MAX_TABLE_CHARS, TABLE_READER, type TableFilter } from '@gab/text/xlsx';
import { WorkbookFault, type ZipSource } from '@gab/text/zip';

// A text set of a CSV file that has no header row, such as the SDN list of OFAC. The request names
// the columns by position, and it can keep the rows whose cell of one column holds one whole tag.
// A cell holds several tags in the form `TAG1] [TAG2`. The file and the request alone make the
// set, never the record, so the same file gives the same rows in the same order. The set is a page
// of the stored document, and no derived document is stored.

/** The mime types that a CSV set reads. A host often serves a CSV as plain bytes. */
export const CSV_MIMES: readonly string[] = [
  'text/csv',
  'application/csv',
  'text/plain',
  'application/octet-stream',
];

/** The most bytes of a CSV file that this reader accepts. The file is read as a stream, so the cap
 * does not set the memory: the kept text does, and MAX_TABLE_CHARS caps it. */
export const MAX_CSV_BYTES = 512 * 1024 * 1024;

const TAG_OPEN = '[';
const TAG_CLOSE = ']';

/** The tags of one cell: `A] [B` gives A and B. A tag may hold spaces and dashes. */
export const tagsOf = (cell: string): string[] =>
  cell
    .split(TAG_CLOSE)
    .map((part) => part.trim().replace(TAG_OPEN, '').trim())
    .filter((tag) => tag !== '');

/** The most characters of a cell that a pattern reads. A longer cell is cut, so a pattern costs a
 * bounded time on each row. */
const MAX_EXTRACT_CHARS = 4096;

/** A group that holds a repeat and is repeated itself, such as `(a+)+`. It can take an
 * exponential time on a cell, so the reader refuses it. */
const NESTED_QUANTIFIER = /\([^)]*[+*}][^)]*\)[+*{]/u;

/** A column that is cut from another column: the first match of the pattern in the cell of `from`,
 * and the text of its one capture group. A row with no match gets an empty cell. */
export interface Extraction {
  readonly name: string;
  readonly from: string;
  readonly pattern: string;
}

/** The name of a CSV set. The same columns and the same filters give the same name, and the
 * name holds the version of the reader. */
export const csvSetName = (
  columns: readonly string[],
  tag?: TableFilter,
  equals: readonly TableFilter[] = [],
  skip = 0,
  extract: readonly Extraction[] = [],
): string =>
  `${TABLE_READER}|csv=${columns.join(',')}` +
  (skip > 0 ? `|skip=${String(skip)}` : '') +
  // The order of the extractions sets the order of the new columns, so it stays in the name. The
  // pattern is quoted as JSON text, so no pattern can look like another part of the name.
  extract.map((one) => `|extract=${one.name}:${one.from}:${JSON.stringify(one.pattern)}`).join('') +
  (tag === undefined ? '' : `|tag=${tag.column}=${tag.value}`) +
  // The filters are sorted by column, so the same filters in another order give the same name.
  [...equals]
    .sort((a, b) => (a.column < b.column ? -1 : a.column > b.column ? 1 : 0))
    .map((filter) => `|equals=${filter.column}=${filter.value.trim()}`)
    .join('');

const CHUNK_BYTES = 1024 * 1024;

/** The most characters of one field. A quote that never closes would otherwise fill the memory. */
const MAX_FIELD_CHARS = 1024 * 1024;

const QUOTE = '"';
const COMMA = ',';
const CR = '\r';
const LF = '\n';
const BOM = '\uFEFF';

/** The most fields of one record. A line of commas would otherwise fill the memory. */
const MAX_FIELDS = 10_000;

/** The records of a CSV file, read as a stream of chunks. It follows RFC 4180 as `readCsv` does
 * (`readCsv` is in the release package, which the browser reads too, and it holds the whole page):
 * a line that holds nothing is no record, and a CR, a LF or a CRLF ends a record. The memory is
 * one chunk and one record. One field and one record have a cap each, and the test compares the
 * two readers at every small chunk size. */
export async function* csvRecords(
  source: ZipSource,
  chunkBytes = CHUNK_BYTES,
): AsyncGenerator<string[]> {
  if (source.size > MAX_CSV_BYTES)
    throw new WorkbookFault(`the file is larger than ${String(MAX_CSV_BYTES)} bytes`);
  const decoder = new TextDecoder();
  let fields: string[] = [];
  let field = '';
  // `quoteSeen`: a quote inside a quoted field closes it, unless the next character is a quote.
  const state = { inQuote: false, quoteSeen: false, hasContent: false };
  let afterCr = false;
  let first = true;
  let record = 1;

  const checked = (): void => {
    if (field.length > MAX_FIELD_CHARS)
      throw new WorkbookFault(
        `a field of the record ${String(record)} holds more than ${String(MAX_FIELD_CHARS)} characters`,
      );
  };

  // The records that end inside one piece of text.
  const feed = (text: string): string[][] => {
    const done: string[][] = [];
    for (const point of text) {
      if (afterCr) {
        afterCr = false;
        if (point === LF) continue;
      }
      if (state.inQuote) {
        if (state.quoteSeen) {
          state.quoteSeen = false;
          if (point === QUOTE) {
            field += QUOTE;
            checked();
            continue;
          }
          state.inQuote = false;
        } else if (point === QUOTE) {
          state.quoteSeen = true;
          continue;
        } else {
          field += point;
          checked();
          continue;
        }
      }
      if (point === CR || point === LF) {
        afterCr = point === CR;
        if (state.hasContent) {
          done.push([...fields, field]);
          record += 1;
        }
        fields = [];
        field = '';
        state.hasContent = false;
        continue;
      }
      state.hasContent = true;
      if (point === QUOTE && field === '') state.inQuote = true;
      else if (point === COMMA) {
        fields.push(field);
        field = '';
        if (fields.length > MAX_FIELDS)
          throw new WorkbookFault(
            `the record ${String(record)} holds more than ${String(MAX_FIELDS)} fields`,
          );
      } else {
        field += point;
        checked();
      }
    }
    return done;
  };

  for (let at = 0; at < source.size; at += chunkBytes) {
    let text = decoder.decode(await source.read(at, Math.min(chunkBytes, source.size - at)), {
      stream: true,
    });
    if (first && text !== '') {
      first = false;
      if (text.startsWith(BOM)) text = text.slice(1);
    }
    yield* feed(text);
  }
  yield* feed(decoder.decode());
  if (state.inQuote && !state.quoteSeen)
    throw new WorkbookFault(`a quote of the record ${String(record)} never closes`);
  if (state.hasContent) yield [...fields, field];
}

/** A CSV with no header row as CSV text: the header row of the given names, then each row that all
 * the filters keep. The tag filter and each exact-value filter must hold. A cell is compared after
 * its spaces at both ends are cut. A row is padded or cut to the number of names of the file, and
 * each extraction adds a column at the end. A filter may name a new column. The first `skip`
 * records, such as a title line and the header, are dropped before the filters. */
export const headlessCsv = async (
  source: ZipSource,
  columns: readonly string[],
  tag?: TableFilter,
  equals: readonly TableFilter[] = [],
  skip = 0,
  extract: readonly Extraction[] = [],
): Promise<string> => {
  if (!Number.isInteger(skip) || skip < 0) throw new WorkbookFault('skip is a count of records');
  if (columns.length === 0 || columns.some((name) => name.trim() === ''))
    throw new WorkbookFault('give a name to each column');
  if (new Set(columns).size !== columns.length)
    throw new WorkbookFault('the names of the columns must differ');
  if (columns.some((name) => /[,|=]/u.test(name)))
    throw new WorkbookFault('a name of a column holds no comma, bar or equals sign');
  if (tag !== undefined && (tag.value.trim() === '' || /[[\]]/u.test(tag.value)))
    throw new WorkbookFault('a tag is not empty and holds no bracket');
  if (tag?.value.includes('|') === true) throw new WorkbookFault('a tag holds no bar');
  const patterns = extract.map((one) => {
    if (one.name.trim() === '') throw new WorkbookFault('give a name to each new column');
    if (/[,|=:]/u.test(one.name))
      throw new WorkbookFault('a name of a new column holds no comma, bar, colon or equals sign');
    if (one.from.includes(':')) throw new WorkbookFault('a source column holds no colon');
    if (!columns.includes(one.from))
      throw new WorkbookFault(`the columns hold no column "${one.from}"`);
    let pattern: RegExp;
    let groups: number;
    try {
      pattern = new RegExp(one.pattern, 'u');
      // An empty alternative added to the pattern always matches, so its groups count.
      groups = (new RegExp(`${one.pattern}|`, 'u').exec('')?.length ?? 1) - 1;
    } catch {
      throw new WorkbookFault(
        `the pattern "${one.pattern}" is not a valid pattern (the unicode mode is on: escape only a special character)`,
      );
    }
    if (NESTED_QUANTIFIER.test(one.pattern))
      throw new WorkbookFault(`the pattern "${one.pattern}" repeats a group that holds a repeat`);
    if (groups !== 1)
      throw new WorkbookFault(`the pattern "${one.pattern}" needs exactly one capture group`);
    return { from: columns.indexOf(one.from), pattern };
  });
  const names = extract.map((one) => one.name);
  const all = [...columns, ...names];
  if (new Set(all).size !== all.length)
    throw new WorkbookFault('the name of a new column clashes with another column');
  const seen = new Set<string>(tag === undefined ? [] : [tag.column]);
  const exact: { at: number; value: string }[] = [];
  for (const filter of equals) {
    if (filter.value.trim() === '') throw new WorkbookFault('a value is not empty');
    if (filter.value.includes('|')) throw new WorkbookFault('a value holds no bar');
    const index = all.indexOf(filter.column);
    if (index === -1) throw new WorkbookFault(`the columns hold no column "${filter.column}"`);
    if (seen.has(filter.column))
      throw new WorkbookFault(`the column "${filter.column}" has more than one filter`);
    seen.add(filter.column);
    exact.push({ at: index, value: filter.value.trim() });
  }
  const at = tag === undefined ? -1 : all.indexOf(tag.column);
  if (tag !== undefined && at === -1)
    throw new WorkbookFault(`the columns hold no column "${tag.column}"`);

  const rows: string[][] = [all];
  let chars = 0;
  const passes = (row: readonly string[], base: boolean): boolean => {
    if (
      tag !== undefined &&
      at < columns.length === base &&
      !tagsOf(row[at] ?? '').includes(tag.value)
    )
      return false;
    return !exact.some(
      (filter) =>
        filter.at < columns.length === base && (row[filter.at] ?? '').trim() !== filter.value,
    );
  };
  let dropped = 0;
  for await (const fields of csvRecords(source)) {
    if (dropped < skip) {
      dropped += 1;
      continue;
    }
    const row = Array.from({ length: columns.length }, (_, index) => fields[index] ?? '');
    // The filters on the columns of the file run first, so a dropped row costs no pattern.
    if (!passes(row, true)) continue;
    for (const one of patterns)
      row.push(one.pattern.exec((row[one.from] ?? '').slice(0, MAX_EXTRACT_CHARS))?.[1] ?? '');
    if (!passes(row, false)) continue;
    chars += row.reduce((sum, cell) => sum + cell.length + 1, 0);
    if (chars > MAX_TABLE_CHARS)
      throw new WorkbookFault(
        `the read keeps more than ${String(MAX_TABLE_CHARS)} characters: give a filter`,
      );
    rows.push(row);
  }
  return csvOf(rows);
};
