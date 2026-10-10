import { CsvFault, readCsv } from '@gab/tools/csv';

/** A CSV file of a release, read back: its header and its rows. */
export interface ReleaseTable {
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** A file of a release cannot be read back as a table. The message names the file. */
export class ReleaseTableFault extends Error {}

/** The files that the changelog compares, each with the columns that it must hold. */
export const TABLE_COLUMNS = {
  'entities.csv': ['id'],
  'relations.csv': ['id'],
  'claims.csv': ['claim_id'],
  'merges.csv': ['act_id', 'absorbed_id', 'resolves_to'],
} as const;

export type ReleaseTableName = keyof typeof TABLE_COLUMNS;

/** The four tables of a release that the changelog compares. */
export type ReleaseTables = Readonly<Record<ReleaseTableName, ReleaseTable>>;

const BOM = '\uFEFF';

/** Reads a CSV file of a release. It skips the byte order mark and the preamble: the lines at the
 * top that start with `#`. A preamble line can hold a quote that a CSV reader would open, and a
 * value of a row can hold a line that starts with `#`, so only the lines before the header are
 * skipped, and they are skipped before the CSV reader. */
export const readReleaseTable = (text: string): ReleaseTable => {
  let at = text.startsWith(BOM) ? BOM.length : 0;
  while (text.startsWith('#', at)) {
    const end = text.indexOf('\n', at);
    at = end < 0 ? text.length : end + 1;
  }
  let records;
  try {
    records = readCsv(text.slice(at));
  } catch (fault) {
    if (fault instanceof CsvFault) throw new ReleaseTableFault(fault.message);
    throw fault;
  }
  const [header, ...rows] = records.map((record) => record.fields);
  if (header === undefined) throw new ReleaseTableFault('the file has no header');
  return { header, rows };
};

/** Reads the four tables that the changelog compares. `textOf` gives the text of a file of the
 * release, or undefined when the release has no such file. A release with no log of the merges
 * reads as a release with no merge. */
export const readReleaseTables = (textOf: (path: string) => string | undefined): ReleaseTables => {
  const read = (name: ReleaseTableName): ReleaseTable => {
    const text = textOf(name);
    // A release before the log of the merges has no such file, and it had no merge.
    if (text === undefined && name === 'merges.csv')
      return { header: [...TABLE_COLUMNS[name]], rows: [] };
    if (text === undefined) throw new ReleaseTableFault(`${name}: the release lists no such file`);
    let table;
    try {
      table = readReleaseTable(text);
    } catch (fault) {
      if (fault instanceof ReleaseTableFault)
        throw new ReleaseTableFault(`${name}: ${fault.message}`);
      throw fault;
    }
    for (const column of TABLE_COLUMNS[name])
      if (!table.header.includes(column))
        throw new ReleaseTableFault(`${name}: the file has no column ${column}`);
    return table;
  };
  return {
    'entities.csv': read('entities.csv'),
    'relations.csv': read('relations.csv'),
    'claims.csv': read('claims.csv'),
    'merges.csv': read('merges.csv'),
  };
};
