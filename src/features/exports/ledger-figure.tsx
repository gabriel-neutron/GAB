import { cn } from '@/shared/lib/utils';
import { READING_LINK } from '@/shared/page/reading-link';

import { FigureFrame } from './figure-frame';
import type { FigureRow } from './figure-rows';
import { sourceOf, type ValueSource } from './value-source';
import { valueWords } from './value-words';

export interface LedgerFigureProps {
  readonly number: number;
  readonly title: string;
  readonly rows: readonly FigureRow[];
  readonly documents: ReadonlyMap<string, ValueSource>;
}

// Grey steps, and the written class beside each one: the paint is never the only mark.
const SWATCHES = ['bg-foreground', 'bg-muted-foreground', 'bg-label', 'bg-input', 'bg-border'];

const firstSeen = (words: readonly string[]): readonly string[] => [...new Set(words)];

/** The revenue ledger: one stacked bar for each period, one part for each legal class, and under
 * the bar each class with its value, which links to the document of the value. */
export function LedgerFigure({ number, title, rows, documents }: LedgerFigureProps) {
  const classes = firstSeen(rows.map((row) => row.serie));
  return (
    <FigureFrame number={number} title={title} rows={rows} documents={documents}>
      <div className="flex flex-col gap-4">
        {firstSeen(rows.map((row) => row.period)).map((period) => {
          const own = rows.filter((row) => row.period === period);
          const total = own.reduce((sum, row) => sum + row.value, 0);
          return (
            <div key={period} className="flex flex-col gap-1.5">
              <h3 className="font-mono font-medium">{period}</h3>
              <div aria-hidden="true" className="flex h-4 w-full border border-border">
                {own.map((row) => (
                  <span
                    key={row.serie}
                    className={cn(
                      'h-full border-r border-background',
                      SWATCHES[classes.indexOf(row.serie) % SWATCHES.length],
                    )}
                    style={{ width: `${String(total === 0 ? 0 : (row.value / total) * 100)}%` }}
                  />
                ))}
              </div>
              <ul className="flex flex-col gap-0.5 text-xs/5">
                {own.map((row) => {
                  const source = sourceOf(row, documents);
                  return (
                    <li key={row.serie} className="flex flex-wrap items-baseline gap-x-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'size-2 shrink-0 self-center border border-border',
                          SWATCHES[classes.indexOf(row.serie) % SWATCHES.length],
                        )}
                      />
                      <span className="min-w-0 break-words">{row.serie}</span>
                      <span className="font-mono tabular-nums">
                        {valueWords(row.value, row.unit)}
                      </span>
                      {source.href === null ? (
                        <span className="text-label">{source.words}</span>
                      ) : (
                        <a className={cn(READING_LINK, 'text-label')} href={source.href}>
                          {source.words}
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </FigureFrame>
  );
}
