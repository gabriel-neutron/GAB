/** One record of a CSV page: its fields, and where it stands in the page. */
export interface CsvRecord {
  readonly fields: readonly string[];
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
        field = '';
        at += 1;
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
    if (points[at] === CR && points[at + 1] === LF) at += 2;
    else if (at < points.length) at += 1;

    if (end > start) records.push({ fields, start, end });
  }
  return records;
};
