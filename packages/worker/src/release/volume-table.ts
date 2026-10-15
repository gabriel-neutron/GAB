import type { ProductKey } from '@gab/proposal/relation-types';
import { CsvFault, readCsv } from '@gab/tools/csv';

/** The volume table cannot be read at all. The message names the fault to correct. */
export class VolumeTableFault extends Error {}

export type VolumeClass = 'observed' | 'estimated' | 'capacity';

/** One row of the volume table that the release keeps. A volume is an aggregate of the research,
 * not a fact of the record. */
export interface VolumeRow {
  readonly line: number;
  /** The entity identifier of the upstream asset in the record, in lower case, or the text of the
   * research for an asset that the record does not hold. */
  readonly upstream: string;
  readonly downstream: string;
  readonly product: ProductKey;
  readonly period: string;
  /** The central value. */
  readonly value: number;
  readonly minimum: number | null;
  readonly maximum: number | null;
  /** The unit of the source. Two rows with different units are never compared. */
  readonly unit: string;
  readonly volumeClass: VolumeClass;
  /** The identifier of the stored source document. */
  readonly document: string;
  readonly page: string;
  readonly note: string;
}

/** A row that the release leaves out, with its line in the file and the reason. */
export interface VolumeRejection {
  readonly line: number;
  readonly why: string;
}

export interface VolumeTable {
  readonly rows: readonly VolumeRow[];
  readonly rejected: readonly VolumeRejection[];
}

// The research writes the table in French, so the columns and the words of a class are French.
const VOLUME_COLUMNS = [
  'actif_amont',
  'actif_aval',
  'produit',
  'periode',
  'valeur',
  'minimum',
  'maximum',
  'unite',
  'classe',
  'document',
  'page',
  'note',
] as const;

type Column = (typeof VOLUME_COLUMNS)[number];

const CLASSES: ReadonlyMap<string, VolumeClass> = new Map([
  ['observé', 'observed'],
  ['estimé', 'estimated'],
  ['capacité', 'capacity'],
]);

const PRODUCTS: ReadonlyMap<string, ProductKey> = new Map([
  ['brut', 'crude'],
  ['pétrole brut', 'crude'],
  ['crude', 'crude'],
  ['produits', 'products'],
  ['produits pétroliers', 'products'],
  ['products', 'products'],
  ['gaz', 'gas'],
  ['gaz naturel', 'gas'],
  ['gnl', 'gas'],
  ['gas', 'gas'],
  ['lng', 'gas'],
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// The research writes French numbers: a comma for the decimals and a space between the groups. The
// space class of JavaScript also holds the no-break spaces that a spreadsheet puts there.
const NUMBER = /^\d+(\.\d+)?$/u;
const numberOf = (text: string): number | null => {
  const plain = text.replace(/\s/gu, '').replace(',', '.');
  return NUMBER.test(plain) ? Number(plain) : null;
};

// The identifier of an entity is in lower case in the release, and a spreadsheet can give it in
// upper case.
const assetOf = (text: string): string => (UUID.test(text) ? text.toLowerCase() : text);

const textOf = (table: Uint8Array | string): string => {
  if (typeof table === 'string') return table;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(table);
  } catch {
    throw new VolumeTableFault('The volume table is not UTF-8. Save it as CSV UTF-8.');
  }
};

/** Reads the volume table: a CSV file in UTF-8 with a header of the twelve columns, in any order.
 * A line that starts with `#` is a note. A row with no source document, no class, no central
 * value, no unit, no period or an unknown product is rejected with its reason, and the other rows
 * stay. An estimate needs its range, and a range holds its central value. */
export const readVolumeTable = (table: Uint8Array | string): VolumeTable => {
  const text = textOf(table);
  const points = Array.from(text);
  const lineAt = (start: number): number =>
    1 + points.slice(0, start).filter((point) => point === '\n').length;

  let records;
  try {
    records = readCsv(text).filter((record) => !(record.fields[0] ?? '').startsWith('#'));
  } catch (fault) {
    if (!(fault instanceof CsvFault)) throw fault;
    throw new VolumeTableFault(`The volume table is not a valid CSV file: ${fault.message}.`);
  }
  const [header, ...body] = records;
  if (header === undefined) throw new VolumeTableFault('The volume table has no header.');
  const names = header.fields.map((name) => name.trim());
  for (const name of VOLUME_COLUMNS)
    if (names.filter((one) => one === name).length !== 1)
      throw new VolumeTableFault(
        `The volume table is refused: give the column ${name} once. The columns are ${VOLUME_COLUMNS.join(', ')}.`,
      );

  const rows: VolumeRow[] = [];
  const rejected: VolumeRejection[] = [];
  for (const record of body) {
    const line = lineAt(record.start);
    const field = (column: Column): string => (record.fields[names.indexOf(column)] ?? '').trim();
    const reject = (why: string): void => {
      rejected.push({ line, why });
    };

    const document = field('document');
    const volumeClass = CLASSES.get(field('classe').toLowerCase());
    const product = PRODUCTS.get(field('produit').toLowerCase());
    const value = numberOf(field('valeur'));
    const minimum = field('minimum') === '' ? null : numberOf(field('minimum'));
    const maximum = field('maximum') === '' ? null : numberOf(field('maximum'));
    const unit = field('unite');
    if (document === '') reject('the row gives no source document');
    else if (volumeClass === undefined)
      reject(`give the class observé, estimé or capacité, not "${field('classe')}"`);
    else if (field('actif_amont') === '' || field('actif_aval') === '')
      reject('give the upstream asset and the downstream asset');
    else if (product === undefined)
      reject(`give the product brut, produits or gaz, not "${field('produit')}"`);
    else if (field('periode') === '') reject('give the period');
    else if (value === null) reject(`give the central value in valeur as a number`);
    else if (unit === '') reject('give the unit of the source');
    else if (
      (field('minimum') !== '' && minimum === null) ||
      (field('maximum') !== '' && maximum === null)
    )
      reject('give the minimum and the maximum as numbers');
    else if ((minimum === null) !== (maximum === null))
      reject('give both ends of the range, or neither');
    else if (volumeClass === 'estimated' && minimum === null)
      reject('an estimate gives its range in minimum and maximum');
    else if (minimum !== null && maximum !== null && !(minimum <= value && value <= maximum))
      reject('the range does not hold the central value');
    else
      rows.push({
        line,
        upstream: assetOf(field('actif_amont')),
        downstream: assetOf(field('actif_aval')),
        product,
        period: field('periode'),
        value,
        minimum,
        maximum,
        unit,
        volumeClass,
        document,
        page: field('page'),
        note: field('note'),
      });
  }
  return { rows, rejected };
};
