import { CsvFault } from './csv.ts';

/** One value of a row, and where its raw text stands in the page, quotes included. */
export interface CsvField {
  readonly start: number;
  readonly end: number;
  readonly value: string;
}

/** One RFC 4180 row of a page. The offsets count UTF-16 units, so a slice of the page from the
 * start to the end of a row or of a field is a quote of the page. */
export interface CsvRow {
  readonly start: number;
  readonly end: number;
  readonly fields: readonly CsvField[];
}

const isBreak = (unit: string | undefined): boolean => unit === '\n' || unit === '\r';

// Departure: readCsv counts code points and holds every row at once, which a file of 50 MB makes
// too slow and too large. This reader walks the page once and gives one row at a time.
/** The rows of a page, one at a time. A line that holds nothing is no row. */
export function* csvRows(page: string): Generator<CsvRow> {
  const length = page.length;
  let at = page.startsWith('﻿') ? 1 : 0;
  while (at < length) {
    const start = at;
    const fields: CsvField[] = [];
    for (;;) {
      const fieldStart = at;
      let value = '';
      if (page[at] === '"') {
        let from = at + 1;
        for (;;) {
          const close = page.indexOf('"', from);
          if (close === -1) throw new CsvFault(`a quote at ${String(fieldStart)} never closes`);
          value += page.slice(from, close);
          if (page[close + 1] !== '"') {
            at = close + 1;
            break;
          }
          value += '"';
          from = close + 2;
        }
      }
      const stop = at;
      while (at < length && page[at] !== ',' && !isBreak(page[at])) at += 1;
      value += page.slice(stop, at);
      fields.push({ start: fieldStart, end: at, value });
      if (page[at] !== ',') break;
      at += 1;
    }
    const end = at;
    if (page[at] === '\r') at += 1;
    if (page[at] === '\n') at += 1;
    if (end > start) yield { start, end, fields };
  }
}
