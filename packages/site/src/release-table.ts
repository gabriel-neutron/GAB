import { readCsv } from '@gab/tools/csv';

import { SiteReleaseFault } from './site-release-fault.ts';

const BOM = '﻿';

/** The rows of one CSV file of a release, each as its cells by column name. The preamble (the
 * lines at the top that start with `#`) is skipped before the CSV reader, because a line of the
 * preamble can hold a quote that the reader would open. Each name of `columns` must be in the
 * header. */
export const readReleaseRows = (
  path: string,
  text: string,
  columns: readonly string[],
): readonly Readonly<Record<string, string>>[] => {
  let at = text.startsWith(BOM) ? BOM.length : 0;
  while (text.startsWith('#', at)) {
    const end = text.indexOf('\n', at);
    at = end < 0 ? text.length : end + 1;
  }
  const [header, ...rows] = readCsv(text.slice(at)).map((record) => record.fields);
  if (header === undefined) throw new SiteReleaseFault(`${path}: the file has no header`);
  for (const column of columns)
    if (!header.includes(column))
      throw new SiteReleaseFault(`${path}: the file has no column ${column}`);
  return rows.map((row) =>
    Object.fromEntries(header.map((column, index) => [column, row[index] ?? ''])),
  );
};
