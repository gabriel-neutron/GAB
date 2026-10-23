import { claimText } from '@gab/release/claim-text';
import type { SiteRelease } from '@gab/release/site-release';

import { folded } from '@/shared/text-fold';

export type Dataset = 'entities' | 'relations' | 'claims';

export const DATASETS: readonly { readonly key: Dataset; readonly words: string }[] = [
  { key: 'entities', words: 'Entities' },
  { key: 'relations', words: 'Relations' },
  { key: 'claims', words: 'Claims' },
];

/** One row of a dataset: the cells of its file, and the three values that a filter reads. */
export interface DataRow {
  readonly id: string;
  /** The type of an entity or a relation, or the kind of a claim. */
  readonly kind: string;
  /** The label that tells who decided the row, without its date. */
  readonly decider: string;
  readonly cells: readonly string[];
}

export interface DataTable {
  readonly columns: readonly string[];
  readonly rows: readonly DataRow[];
}

export interface DataFilter {
  readonly kind: string;
  readonly decider: string;
  readonly text: string;
}

export const NO_FILTER: DataFilter = { kind: '', decider: '', text: '' };

// The date at the end of a label changes with each decision, and the words before it do not.
const deciderOf = (label: string): string => label.replace(/, on \d{4}-\d{2}-\d{2}$/u, '');

const rowOf = (
  id: string,
  kind: string,
  originLabel: string,
  cells: readonly string[],
): DataRow => ({ id, kind, decider: deciderOf(originLabel), cells });

/** The rows of one dataset, with the columns of its file in the release. */
export function tableOf(release: SiteRelease, dataset: Dataset): DataTable {
  switch (dataset) {
    case 'entities':
      return {
        columns: ['id', 'type', 'label', 'origin_label', 'licence', 'geolocation_method'],
        rows: release.entities.map((one) =>
          rowOf(one.id, one.type, one.originLabel, [
            one.id,
            one.type,
            one.label,
            one.originLabel,
            one.licence,
            one.geolocationMethod ?? '',
          ]),
        ),
      };
    case 'relations':
      return {
        columns: [
          'id',
          'type',
          'from_label',
          'to_label',
          'valid_from',
          'valid_to',
          'origin_label',
          'licence',
        ],
        rows: release.relations.map((one) =>
          rowOf(one.id, one.type, one.originLabel, [
            one.id,
            one.type,
            one.fromLabel,
            one.toLabel,
            one.validFrom ?? '',
            one.validTo ?? '',
            one.originLabel,
            one.licence,
          ]),
        ),
      };
    case 'claims':
      return {
        columns: ['id', 'kind', 'claim', 'origin_label', 'licence', 'nato_pair', 'sources'],
        rows: release.claims.map((one) =>
          rowOf(one.id, one.kind, one.originLabel, [
            one.id,
            one.kind,
            claimText(one),
            one.originLabel,
            one.licence,
            one.pair === null ? '' : `${one.pair.letter}${one.pair.digit}`,
            one.sources.map((source) => source.title).join(' | '),
          ]),
        ),
      };
  }
}

/** The values that a filter can pick, in the order of their first row. */
export const choices = (rows: readonly DataRow[], by: 'kind' | 'decider'): readonly string[] =>
  [...new Set(rows.map((row) => row[by]))].sort((a, b) => a.localeCompare(b));

/** The rows that pass the filter. The text is read in each cell, with case and accents folded. */
export function filterRows(rows: readonly DataRow[], filter: DataFilter): readonly DataRow[] {
  const asked = folded(filter.text);
  return rows.filter(
    (row) =>
      (filter.kind === '' || row.kind === filter.kind) &&
      (filter.decider === '' || row.decider === filter.decider) &&
      (asked === '' || row.cells.some((cell) => folded(cell).includes(asked))),
  );
}

// The mark that tells a spreadsheet the file is UTF-8, as the files of the release do.
const BOM = String.fromCharCode(0xfeff);

const quoted = (cell: string): string =>
  /[",\r\n]/u.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;

/** A CSV file as the release writes one: the disclaimer on lines that start with `#`, then the
 * header, then the rows. A row keeps its label, so a copy of it keeps its label too. */
export function toCsv(
  disclaimer: string,
  columns: readonly string[],
  rows: readonly DataRow[],
): string {
  const notice = disclaimer
    .split('\n')
    .map((line) => (line === '' ? '#' : `# ${line}`))
    .join('\n');
  const lines = [columns, ...rows.map((row) => row.cells)].map((cells) =>
    cells.map(quoted).join(','),
  );
  return `${BOM}${notice}\n${lines.join('\n')}\n`;
}
