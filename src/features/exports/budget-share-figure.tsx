import { DataTable } from '@/shared/page/data-table';
import { READING_LINK } from '@/shared/page/reading-link';

import { FigureFrame } from './figure-frame';
import type { FigureRow } from './figure-rows';
import { sourceOf, type ValueSource } from './value-source';
import { valueWords } from './value-words';

export interface BudgetShareFigureProps {
  readonly number: number;
  readonly title: string;
  readonly rows: readonly FigureRow[];
  readonly documents: ReadonlyMap<string, ValueSource>;
}

const WIDTH = 640;
const HEIGHT = 200;
const LEFT = 8;
const RIGHT = 150;
const TOP = 28;
const BOTTOM = 24;

const firstSeen = (words: readonly string[]): readonly string[] => [...new Set(words)];

// The value axis starts at zero and ends at a round number above the largest value.
const ceiling = (largest: number): number => {
  if (largest <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(largest));
  return Math.ceil(largest / step) * step;
};

/** The budget share: one line for each series over the periods, on an axis from zero. The values
 * and their documents are in a table under the line, because a line of many points holds no
 * readable link for each of them. */
export function BudgetShareFigure({ number, title, rows, documents }: BudgetShareFigureProps) {
  const periods = firstSeen(rows.map((row) => row.period));
  const top = ceiling(Math.max(0, ...rows.map((row) => row.value)));
  // A negative value moves the foot of the axis down, so the line never leaves the plot.
  const foot = Math.min(0, ...rows.map((row) => row.value));
  const x = (period: string): number =>
    LEFT + ((WIDTH - LEFT - RIGHT) * periods.indexOf(period)) / Math.max(1, periods.length - 1);
  const y = (value: number): number =>
    TOP + ((HEIGHT - TOP - BOTTOM) * (top - value)) / (top - foot);
  const unit = rows[0]?.unit ?? '';
  const series = firstSeen(rows.map((row) => row.serie));
  const ends = [periods[0], periods.at(-1)];
  return (
    <FigureFrame number={number} title={title} rows={rows} documents={documents}>
      <svg
        viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
        role="img"
        aria-label={`${title}, ${series.join(', ')}, from ${periods[0] ?? ''} to ${periods.at(-1) ?? ''}. The values are in the table below the figure.`}
        className="h-auto w-full"
      >
        <text x={LEFT} y={12} className="fill-label font-sans text-small">
          {unit}
        </text>
        {[...new Set([foot, 0, top / 2, top])].map((tick) => (
          <g key={tick}>
            <line
              x1={LEFT}
              x2={WIDTH - RIGHT}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text x={WIDTH - RIGHT + 4} y={y(tick) + 3} className="fill-label font-mono text-small">
              {valueWords(tick, '')}
            </text>
          </g>
        ))}
        {ends.map((period, place) =>
          period === undefined ? null : (
            <text
              key={period}
              x={x(period)}
              y={HEIGHT - 6}
              textAnchor={place === 0 ? 'start' : 'end'}
              className="fill-label font-mono text-small"
            >
              {period}
            </text>
          ),
        )}
        {series.map((serie, place) => {
          const own = rows.filter((row) => row.serie === serie);
          const last = own.at(-1);
          return (
            <g key={serie}>
              <polyline
                fill="none"
                points={own
                  .map((row) => `${String(x(row.period))},${String(y(row.value))}`)
                  .join(' ')}
                strokeWidth={1.5}
                strokeDasharray={place === 0 ? undefined : '4 3'}
                className={place === 0 ? 'stroke-foreground' : 'stroke-muted-foreground'}
              />
              {last === undefined ? null : (
                <>
                  <circle
                    cx={x(last.period)}
                    cy={y(last.value)}
                    r={3}
                    className={place === 0 ? 'fill-foreground' : 'fill-muted-foreground'}
                  />
                  <text
                    x={x(last.period) + 8}
                    y={y(last.value) - 6}
                    className="fill-foreground font-mono text-small"
                  >
                    {`${series.length > 1 ? `${serie} ` : ''}${valueWords(last.value, last.unit)}`}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <details className="flex flex-col gap-2">
        <summary className="w-fit cursor-pointer outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          Values and documents
        </summary>
        <DataTable
          name={`${title}, values`}
          columns={[
            { key: 'serie', header: 'Series', cell: (row) => row.serie },
            { key: 'period', header: 'Period', figure: 'text', cell: (row) => row.period },
            {
              key: 'value',
              header: 'Value',
              figure: 'count',
              cell: (row) => valueWords(row.value, row.unit),
            },
            {
              key: 'source',
              header: 'Document',
              cell: (row) => {
                const source = sourceOf(row, documents);
                return source.href === null ? (
                  source.words
                ) : (
                  <a className={READING_LINK} href={source.href}>
                    {source.words}
                  </a>
                );
              },
            },
          ]}
          rows={rows.map((row) => ({ id: `${row.serie}${row.period}`, row }))}
          empty="The file of this figure holds no value."
        />
      </details>
    </FigureFrame>
  );
}
