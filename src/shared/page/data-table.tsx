import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

import { EmptyState } from './empty-state';

export interface DataColumn<Row> {
  readonly key: string;
  readonly header: string;
  /** Null is an absent value, drawn as a blank cell. */
  readonly cell: (row: Row) => ReactNode;
  /** A count, a date or an identifier: monospace, and a count aligns right. */
  readonly figure?: 'count' | 'text';
}

export interface DataTableProps<Row> {
  /** The name of the table, for a screen reader. */
  readonly name: string;
  readonly columns: readonly DataColumn<Row>[];
  readonly rows: readonly { readonly id: string; readonly row: Row }[];
  /** The sentence in place of a table that has no row. */
  readonly empty: string;
}

const HEAD = 'h-7 px-1.5 text-left align-bottom font-normal text-small/4 tracking-caps uppercase';

const CELL = 'px-1.5 py-1.5 align-top';

/** A table of a public page. It keeps the dense scale of the theme inside the reading page, and
 * it scrolls on its own on a narrow screen so the page never does. */
export function DataTable<Row>({ name, columns, rows, empty }: DataTableProps<Row>) {
  if (rows.length === 0) return <EmptyState sentence={empty} />;
  return (
    <div
      // External constraint: a region that scrolls needs a tab stop, or a keyboard cannot reach
      // the cells that are off the screen.
      tabIndex={0}
      className="max-w-full overflow-x-auto outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <table aria-label={name} className="w-full border-collapse border border-border text-xs/5">
        <thead className="border-b border-input bg-muted text-label">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(HEAD, column.figure === 'count' && 'text-right')}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ id, row }) => (
            <tr key={id} className="border-b border-border">
              {columns.map((column, place) => {
                const className = cn(
                  CELL,
                  'font-normal text-left',
                  column.figure !== undefined && 'font-mono tabular-nums',
                  column.figure === 'count' && 'text-right',
                );
                // The first column names the row for a screen reader.
                return place === 0 ? (
                  <th key={column.key} scope="row" className={className}>
                    {column.cell(row)}
                  </th>
                ) : (
                  <td key={column.key} className={className}>
                    {column.cell(row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
