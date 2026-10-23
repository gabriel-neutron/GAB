import type { AttributeValue, Entity } from '@/shared/read/model';

import { folded } from '@/shared/text-fold';

/** One entity as one table row. A key the entity does not state is absent from `values`. */
export interface EntityRow {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly sources: number;
  readonly values: Readonly<Record<string, string>>;
}

export type SortKey = 'label' | 'type' | 'sources' | `attr:${string}`;

export interface Sort {
  readonly key: SortKey;
  readonly direction: 'ascending' | 'descending';
}

/** How many attribute columns the table draws, by how many entities state the key. */
export const ATTRIBUTE_COLUMNS = 3;

const textOf = (value: AttributeValue): string =>
  typeof value === 'boolean'
    ? value
      ? 'yes'
      : 'no'
    : Array.isArray(value)
      ? value.join(', ')
      : String(value);

export const rowsOf = (entities: readonly Entity[]): readonly EntityRow[] =>
  entities.map((entity) => ({
    id: entity.id,
    label: entity.label,
    type: entity.type,
    sources: entity.sources.length,
    values: Object.fromEntries(
      Object.entries(entity.attrs).map(([key, attribute]) => [key, textOf(attribute.v)]),
    ),
  }));

/** The keys that most rows state, most common first. */
export function commonKeys(
  rows: readonly EntityRow[],
  limit = ATTRIBUTE_COLUMNS,
): readonly string[] {
  const counts = new Map<string, number>();
  for (const row of rows)
    for (const key of Object.keys(row.values)) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key]) => key);
}

/** Keeps the rows whose name or type key holds the text, and whose type is the chosen one. An
 * empty text or a null type keeps all. */
export function filterRows(
  rows: readonly EntityRow[],
  text: string,
  type: string | null,
): readonly EntityRow[] {
  const asked = folded(text);
  return rows.filter(
    (row) =>
      (type === null || row.type === type) && (asked === '' || folded(row.label).includes(asked)),
  );
}

const valueOf = (row: EntityRow, key: SortKey): string | number | null => {
  if (key === 'sources') return row.sources;
  if (key === 'label' || key === 'type') return row[key];
  return row.values[key.slice('attr:'.length)] ?? null;
};

// A value that reads as a number sorts as a number. An absent value sorts last in both directions.
export function sortRows(rows: readonly EntityRow[], sort: Sort): readonly EntityRow[] {
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = valueOf(a, sort.key);
    const right = valueOf(b, sort.key);
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const order =
      Number.isNaN(leftNumber) || Number.isNaN(rightNumber)
        ? String(left).localeCompare(String(right), undefined, { numeric: true })
        : leftNumber - rightNumber;
    return sign * order || a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
  });
}

const field = (text: string): string =>
  /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;

/** The rows as CSV text: one line per row, a blank field for an absent value. */
export function csvOf(rows: readonly EntityRow[], keys: readonly string[]): string {
  const lines = [
    ['id', 'name', 'type', 'documents', ...keys],
    ...rows.map((row) => [
      row.id,
      row.label,
      row.type,
      String(row.sources),
      ...keys.map((key) => row.values[key] ?? ''),
    ]),
  ];
  return lines.map((line) => line.map(field).join(',')).join('\r\n') + '\r\n';
}

/** The rows as JSON text, with every attribute the rows state. */
export const jsonOf = (rows: readonly EntityRow[]): string => JSON.stringify(rows, null, 2);
