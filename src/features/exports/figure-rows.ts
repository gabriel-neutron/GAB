import { readCsv } from '@gab/release/csv';

/** One value of a figure, with the place in a document where it is read. */
export interface FigureRow {
  readonly serie: string;
  readonly period: string;
  readonly value: number;
  readonly unit: string;
  /** The identifier or the address of the document. */
  readonly document: string;
  readonly page: string;
  /** The excerpt or the cell where the document gives the value. */
  readonly excerpt: string;
  readonly note: string;
}

const COLUMNS = [
  'serie',
  'periode',
  'valeur',
  'unite',
  'document',
  'page',
  'extrait_ou_cellule',
  'note',
] as const;

const amountOf = (text: string): number | null => {
  // A French file can write the decimal sign as a comma.
  const amount = Number(text.includes('.') ? text : text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(amount) ? null : amount;
};

/** The rows of a long-format file of the report. A missing column or a value that is not a number
 * stops the read: a figure never draws a guess. */
export function readFigureRows(name: string, text: string): readonly FigureRow[] {
  const [header, ...records] = readCsv(text).map((record) => record.fields);
  if (header === undefined) throw new Error(`${name}: the file has no header`);
  for (const column of COLUMNS)
    if (!header.includes(column)) throw new Error(`${name}: the file has no column ${column}`);
  return records.map((fields, line) => {
    const cell = (column: (typeof COLUMNS)[number]): string =>
      (fields[header.indexOf(column)] ?? '').trim();
    const value = amountOf(cell('valeur'));
    if (value === null)
      throw new Error(`${name}: line ${String(line + 2)}: "${cell('valeur')}" is not a number`);
    return {
      serie: cell('serie'),
      period: cell('periode'),
      value,
      unit: cell('unite'),
      document: cell('document'),
      page: cell('page'),
      excerpt: cell('extrait_ou_cellule'),
      note: cell('note'),
    };
  });
}
