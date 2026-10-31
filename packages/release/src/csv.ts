/** One record of a CSV page: its fields, and where it stands in the page. */
export interface CsvRecord {
  readonly fields: readonly string[];
  /** The span of each field, as a pair of code points: a quote of the field is part of it. */
  readonly cells: readonly (readonly [number, number])[];
  /** The first code point of the record. */
  readonly start: number;
  /** One after the last code point of the record. The line break is not part of it. */
  readonly end: number;
}

/** The page holds a quote that never closes, so no record after it can be read. */
export class CsvFault extends Error {}

const QUOTE = '"';
const COMMA = ',';
const CR = '\r';
const LF = '\n';
const BOM = '\uFEFF';

/** Reads a page as RFC 4180 records. The offsets count code points of the page, as a span does,
 * and a library that counts UTF-16 units gives spans that miss the row. A line that holds
 * nothing is no record. */
export const readCsv = (page: string): CsvRecord[] => {
  const points = Array.from(page);
  const records: CsvRecord[] = [];
  let at = points[0] === BOM ? 1 : 0;

  while (at < points.length) {
    const start = at;
    const fields: string[] = [];
    const cells: (readonly [number, number])[] = [];
    let cellStart = at;
    let field = '';
    let quoted = false;
    let ended = false;

    while (at < points.length && !ended) {
      const point = points[at] ?? '';
      if (quoted) {
        if (point === QUOTE && points[at + 1] === QUOTE) {
          field += QUOTE;
          at += 2;
        } else if (point === QUOTE) {
          quoted = false;
          at += 1;
        } else {
          field += point;
          at += 1;
        }
      } else if (point === QUOTE && field === '') {
        quoted = true;
        at += 1;
      } else if (point === COMMA) {
        fields.push(field);
        cells.push([cellStart, at]);
        field = '';
        at += 1;
        cellStart = at;
      } else if (point === CR || point === LF) {
        ended = true;
      } else {
        field += point;
        at += 1;
      }
    }
    if (quoted)
      throw new CsvFault(`a quote that opens at code point ${String(start)} never closes`);

    const end = at;
    fields.push(field);
    cells.push([cellStart, end]);
    if (points[at] === CR && points[at + 1] === LF) at += 2;
    else if (at < points.length) at += 1;

    if (end > start) records.push({ fields, cells, start, end });
  }
  return records;
};

const TAB = '\t';

/** Reads a page as tab-separated records (IANA text/tab-separated-values). A TSV has no quote: a
 * field holds no tab and no line break, and a quote in it is a character of the field. The
 * offsets count code points, as in readCsv, and a line that holds nothing is no record.
 * The TSV of Eurostat puts all the dimensions in its first column, joined by commas, and one
 * column for each period. The reader keeps that shape. Fetch the SDMX-CSV of the same query to
 * get one column for each dimension and one row for each observation. */
export const readTsv = (page: string): CsvRecord[] => {
  const points = Array.from(page);
  const records: CsvRecord[] = [];
  let at = points[0] === BOM ? 1 : 0;

  while (at < points.length) {
    const start = at;
    while (at < points.length && points[at] !== CR && points[at] !== LF) at += 1;
    const end = at;
    if (points[at] === CR && points[at + 1] === LF) at += 2;
    else if (at < points.length) at += 1;

    if (end > start) {
      const fields = points.slice(start, end).join('').split(TAB);
      const cells: (readonly [number, number])[] = [];
      let from = start;
      for (const field of fields) {
        cells.push([from, from + Array.from(field).length]);
        from += Array.from(field).length + 1;
      }
      records.push({ fields, cells, start, end });
    }
  }
  return records;
};
