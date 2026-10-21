import { csvOf, MAX_TABLE_CHARS, TABLE_READER, type TableFilter } from '@gab/text/xlsx';
import { WorkbookFault, type ZipSource } from '@gab/text/zip';
import { readCsv } from '@gab/tools/csv';

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

/** The most bytes of a CSV file that this reader holds. The file is held whole in memory, and the
 * reader makes one item for each code point, so the cap is far below the cap of the kept text. */
export const MAX_CSV_BYTES = 16 * 1024 * 1024;

const TAG_OPEN = '[';
const TAG_CLOSE = ']';

/** The tags of one cell: `A] [B` gives A and B. A tag may hold spaces and dashes. */
export const tagsOf = (cell: string): string[] =>
  cell
    .split(TAG_CLOSE)
    .map((part) => part.trim().replace(TAG_OPEN, '').trim())
    .filter((tag) => tag !== '');

/** The name of a CSV set. The same columns and the same tag filter give the same name, and the
 * name holds the version of the reader. */
export const csvSetName = (
  columns: readonly string[],
  tag?: TableFilter,
  equals: readonly TableFilter[] = [],
): string =>
  `${TABLE_READER}|csv=${columns.join(',')}` +
  (tag === undefined ? '' : `|tag=${tag.column}=${tag.value}`) +
  // The filters are sorted by column, so the same filters in another order give the same name.
  [...equals]
    .sort((a, b) => (a.column < b.column ? -1 : a.column > b.column ? 1 : 0))
    .map((filter) => `|equals=${filter.column}=${filter.value}`)
    .join('');

const bytesOf = async (source: ZipSource): Promise<Uint8Array> => {
  if (source.size > MAX_CSV_BYTES)
    throw new WorkbookFault(`the file is larger than ${String(MAX_CSV_BYTES)} bytes`);
  const chunk = 1024 * 1024;
  const out = new Uint8Array(source.size);
  for (let at = 0; at < source.size; at += chunk)
    out.set(await source.read(at, Math.min(chunk, source.size - at)), at);
  return out;
};

/** A CSV with no header row as CSV text: the header row of the given names, then each row that all
 * the filters keep. The tag filter and each exact-value filter must hold. A cell is compared after
 * its spaces at both ends are cut. A row is padded or cut to the number of names. */
export const headlessCsv = async (
  source: ZipSource,
  columns: readonly string[],
  tag?: TableFilter,
  equals: readonly TableFilter[] = [],
): Promise<string> => {
  if (columns.length === 0 || columns.some((name) => name.trim() === ''))
    throw new WorkbookFault('give a name to each column');
  if (new Set(columns).size !== columns.length)
    throw new WorkbookFault('the names of the columns must differ');
  if (columns.some((name) => /[,|=]/u.test(name)))
    throw new WorkbookFault('a name of a column holds no comma, bar or equals sign');
  if (tag !== undefined && (tag.value.trim() === '' || /[[\]]/u.test(tag.value)))
    throw new WorkbookFault('a tag is not empty and holds no bracket');
  if (tag?.value.includes('|') === true) throw new WorkbookFault('a tag holds no bar');
  const seen = new Set<string>(tag === undefined ? [] : [tag.column]);
  const exact: { at: number; value: string }[] = [];
  for (const filter of equals) {
    if (filter.value.trim() === '') throw new WorkbookFault('a value is not empty');
    if (filter.value.includes('|')) throw new WorkbookFault('a value holds no bar');
    const index = columns.indexOf(filter.column);
    if (index === -1) throw new WorkbookFault(`the columns hold no column "${filter.column}"`);
    if (seen.has(filter.column))
      throw new WorkbookFault(`the column "${filter.column}" has more than one filter`);
    seen.add(filter.column);
    exact.push({ at: index, value: filter.value.trim() });
  }
  const at = tag === undefined ? -1 : columns.indexOf(tag.column);
  if (tag !== undefined && at === -1)
    throw new WorkbookFault(`the columns hold no column "${tag.column}"`);

  const text = new TextDecoder().decode(await bytesOf(source));
  const kept = [...columns];
  const rows: string[][] = [kept];
  let chars = 0;
  for (const { fields } of readCsv(text)) {
    if (tag !== undefined && !tagsOf(fields[at] ?? '').includes(tag.value)) continue;
    if (exact.some((filter) => (fields[filter.at] ?? '').trim() !== filter.value)) continue;
    const row = Array.from({ length: columns.length }, (_, index) => fields[index] ?? '');
    chars += row.reduce((sum, cell) => sum + cell.length + 1, 0);
    if (chars > MAX_TABLE_CHARS)
      throw new WorkbookFault(
        `the read keeps more than ${String(MAX_TABLE_CHARS)} characters: give a filter`,
      );
    rows.push(row);
  }
  return csvOf(rows);
};
