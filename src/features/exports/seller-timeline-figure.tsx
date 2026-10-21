import { DataTable, type DataColumn } from '@/shared/page/data-table';
import { READING_LINK } from '@/shared/page/reading-link';

import { FigureFrame } from './figure-frame';
import type { FigureRow } from './figure-rows';
import { sourceOf, type ValueSource } from './value-source';
import { valueWords } from './value-words';

export interface SellerTimelineFigureProps {
  readonly number: number;
  readonly title: string;
  readonly rows: readonly FigureRow[];
  readonly documents: ReadonlyMap<string, ValueSource>;
}

const firstSeen = (words: readonly string[]): readonly string[] => [...new Set(words)];

/** The seller timeline: one line for each seller, one column for each period. A cell with no value
 * stays blank. A value links to its document, and a bar under it shows its size against the
 * largest value of the same unit. */
export function SellerTimelineFigure({
  number,
  title,
  rows,
  documents,
}: SellerTimelineFigureProps) {
  const largest = new Map<string, number>();
  for (const row of rows) largest.set(row.unit, Math.max(largest.get(row.unit) ?? 0, row.value));
  const columns: DataColumn<string>[] = [
    { key: 'seller', header: 'Seller', cell: (seller) => seller },
    ...firstSeen(rows.map((row) => row.period)).map((period): DataColumn<string> => ({
      key: period,
      header: period,
      figure: 'count',
      cell: (seller) => {
        const own = rows.filter((row) => row.serie === seller && row.period === period);
        if (own.length === 0) return null;
        return (
          <span className="flex flex-col items-end gap-1">
            {own.map((row) => {
              const source = sourceOf(row, documents);
              const words = valueWords(row.value, row.unit);
              const max = largest.get(row.unit) ?? 0;
              return (
                <span
                  key={`${row.serie}${row.period}${row.document}${row.excerpt}`}
                  className="flex flex-col items-end gap-0.5"
                >
                  {source.href === null ? (
                    <span title={source.words}>{words}</span>
                  ) : (
                    <a
                      className={READING_LINK}
                      href={source.href}
                      aria-label={`${words}. ${source.words}`}
                    >
                      {words}
                    </a>
                  )}
                  <span
                    aria-hidden="true"
                    className="h-1 bg-muted-foreground"
                    style={{ width: `${String(max === 0 ? 0 : (row.value / max) * 4)}rem` }}
                  />
                </span>
              );
            })}
          </span>
        );
      },
    })),
  ];
  return (
    <FigureFrame number={number} title={title} rows={rows} documents={documents}>
      <DataTable
        name={title}
        columns={columns}
        rows={firstSeen(rows.map((row) => row.serie)).map((seller) => ({
          id: seller,
          row: seller,
        }))}
        empty="The file of this figure holds no value."
      />
    </FigureFrame>
  );
}
