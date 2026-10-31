import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { fightUi, figureTexts } from '../../content';
import figures from '../../data/publication-figures.json';

const copy = fightUi.suppliers;
const labels = figureTexts.figures['10'].labels;
const YEARS = [2021, 2022, 2023, 2024, 2025] as const;
// The scale runs past the top tick, so the share over the tallest bar stays under the frame.
const MAX = 14000;
const TICKS = [0, 4000, 8000, 12000];

type Points = readonly (readonly (number | null)[])[];
const valueAt = (points: Points, year: number): number | null =>
  points.find((point) => point[0] === year)?.[1] ?? null;

// A hatch of the accent: Hong Kong shares the accent of China (the text names them as one group),
// but reads as its own band.
const HATCH =
  'bg-[repeating-linear-gradient(135deg,var(--signal)_0_2px,transparent_2px_5px)] ring-1 ring-inset ring-signal';
// A hatch of grey: a year with no declared value.
const GAP = 'bg-[repeating-linear-gradient(135deg,var(--label)_0_1px,transparent_1px_4px)]';

// Bottom to top. The coalition takes the ink, as in the strips of the chain story.
const SERIES = [
  { key: 'Coalition', label: labels.Coalition, ink: 'bg-foreground' },
  { key: 'China', label: labels.Chine, ink: 'bg-signal' },
  { key: 'Hong Kong', label: labels['Hong Kong'], ink: HATCH },
  { key: 'Nine third countries', label: labels['Neuf pays tiers'], ink: 'bg-chart-neutral' },
] as const;

const SHARE = 'China + Hong Kong share (%)';
const f10a = figures.f10a;
// Sorted by the change from 2023 to 2025, largest rise first; a country with no 2025 value last.
const change = (points: Points) => {
  const from = valueAt(points, 2023);
  const to = valueAt(points, 2025);
  return from === null || to === null || from === 0 ? -Infinity : to / from;
};
const f10b = Object.entries(figures.f10b as Readonly<Record<string, Points>>).sort(
  (a, b) => change(b[1]) - change(a[1]),
);
// One scale for the nine charts, so that a bar height compares across countries.
const MAX_B = Math.max(...f10b.flatMap(([, points]) => points.map((point) => point[1] ?? 0)));

// The event line stands at its day inside its year column.
const eventDate = new Date(`${figures.f10event}T00:00:00Z`);
const eventYear = eventDate.getUTCFullYear();
const yearStart = Date.UTC(eventYear, 0, 1);
const eventLeft =
  ((YEARS.indexOf(eventYear as (typeof YEARS)[number]) +
    (eventDate.getTime() - yearStart) / (Date.UTC(eventYear + 1, 0, 1) - yearStart)) /
    YEARS.length) *
  100;

const fmt = (value: number) => value.toLocaleString('en-US');

function Grow({ share, className }: { readonly share: number; readonly className: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      initial={reduce === true ? false : { scaleY: 0 }}
      whileInView={{ scaleY: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn('block w-full origin-bottom', className)}
      style={{ height: `${String(share * 100)}%` }}
    />
  );
}

const tick = 'font-mono text-[11px]/4 text-label tabular-nums';

/** Figure 10: (a) the declared exports of CHP goods to Russia by reporting country, stacked, with
 * the share of China and Hong Kong over each year; (b) the nine third countries, on one shared
 * scale, with the value over each bar. A missing value shows as a dotted baseline. */
export function SuppliersFigure() {
  return (
    <div className="grid gap-14">
      <div>
        <p className="font-mono text-caption uppercase text-label">
          {copy.a} · {figureTexts.figures['10'].panels[0]?.unit}
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-caption text-muted-foreground">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className={cn('size-2.5', series.ink)} />
              {series.label}
            </li>
          ))}
          <li className="text-signal">
            {labels['Au-dessus de chaque barre : part de la Chine et de Hong Kong.']}
          </li>
        </ul>
        <div aria-hidden="true" className="relative mt-20 ml-12 h-60 md:h-[19rem]">
          {TICKS.map((value) => (
            <div
              key={value}
              className={cn(
                'absolute inset-x-0 border-t',
                value === 0 ? 'border-chart-axis' : 'border-chart-grid',
              )}
              style={{ bottom: `${String((value / MAX) * 100)}%` }}
            >
              <span className={cn('absolute -top-2 -left-12 w-10 text-right', tick)}>
                {fmt(value)}
              </span>
            </div>
          ))}
          <div
            className="absolute -top-12 bottom-0 border-l border-signal"
            style={{ left: `${String(eventLeft)}%` }}
          >
            <span className="absolute top-0 right-1.5 w-[9rem] text-right font-mono text-[11px]/4 text-signal md:right-auto md:left-1.5 md:w-max md:text-left">
              {labels['décret 14114 (22 déc. 2023)']}
            </span>
          </div>
          <div className="absolute inset-0 grid grid-cols-5">
            {YEARS.map((year) => {
              const values = SERIES.map((series) => valueAt(f10a[series.key], year) ?? 0);
              const total = values.reduce((sum, value) => sum + value, 0);
              return (
                <div key={year} className="relative flex flex-col items-center justify-end">
                  <span
                    className="absolute font-mono text-[clamp(0.875rem,2.2vw,1.75rem)]/none tracking-[-0.04em] text-signal tabular-nums"
                    style={{ bottom: `calc(${String((total / MAX) * 100)}% + 0.5rem)` }}
                  >
                    {valueAt(f10a[SHARE], year)}%
                  </span>
                  <div className="flex h-full w-[35%] min-w-3 flex-col-reverse">
                    {SERIES.map((series, index) => (
                      <Grow
                        key={series.key}
                        share={(values[index] ?? 0) / MAX}
                        className={cn('border-t border-background', series.ink)}
                      />
                    ))}
                  </div>
                  <span className={cn('absolute -bottom-6', tick)}>{year}</span>
                </div>
              );
            })}
          </div>
        </div>
        <table className="sr-only">
          <caption>{copy.a}</caption>
          <thead>
            <tr>
              <th scope="col">{copy.year}</th>
              {SERIES.map((series) => (
                <th key={series.key} scope="col">
                  {series.label}
                </th>
              ))}
              <th scope="col">
                {labels['Au-dessus de chaque barre : part de la Chine et de Hong Kong.']}
              </th>
            </tr>
          </thead>
          <tbody>
            {YEARS.map((year) => (
              <tr key={year}>
                <th scope="row">{year}</th>
                {SERIES.map((series) => (
                  <td key={series.key}>{valueAt(f10a[series.key], year)}</td>
                ))}
                <td>{valueAt(f10a[SHARE], year)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4">
        <p className="font-mono text-caption uppercase text-label">
          {copy.b} · {figureTexts.figures['10'].panels[0]?.unit}
        </p>
        <p className="mt-1 text-body-sm text-muted-foreground">
          {copy.bScale.replace('{max}', String(MAX_B))} {copy.bSort}
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-caption text-muted-foreground">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className={cn('h-3 w-5', GAP)} />
            {copy.noValue}
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-5 border-x border-signal bg-signal/10" />
            {copy.sanctionYear}
          </li>
        </ul>
        {/* On a phone the nine charts are one column, so each chart keeps its values and years. */}
        <ul
          aria-hidden="true"
          className="mt-6 grid grid-cols-1 gap-y-8 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 md:grid-cols-3"
        >
          {f10b.map(([country, points], rank) => {
            return (
              <li key={country} className="min-w-0">
                <p className="flex items-baseline gap-2 text-body-sm">
                  <span className="font-mono text-data text-label tabular-nums">
                    {String(rank + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate">{country}</span>
                </p>
                <div className="relative mt-5 grid h-16 grid-cols-5 border-b border-chart-axis sm:mt-6 sm:h-20">
                  {YEARS.map((year) => {
                    const value = valueAt(points, year);
                    return (
                      <div key={year} className="relative flex flex-col items-center justify-end">
                        {year === eventYear ? (
                          <span className="absolute inset-x-0 -top-5 -bottom-px border-x border-signal/60 bg-signal/10" />
                        ) : null}
                        {value === null ? (
                          <>
                            <span className={cn('absolute inset-x-1 bottom-0 h-1/2', GAP)} />
                            <span className="absolute bottom-[calc(50%+0.3rem)] font-mono text-[11px]/3 text-label">
                              {copy.noValueShort}
                            </span>
                          </>
                        ) : (
                          <>
                            <span
                              className="absolute font-mono text-[11px]/3 text-foreground tabular-nums"
                              style={{ bottom: `calc(${String((value / MAX_B) * 100)}% + 0.3rem)` }}
                            >
                              {value}
                            </span>
                            <div className="relative flex h-full w-1 flex-col justify-end">
                              <Grow
                                share={value / MAX_B}
                                className={year === eventYear ? 'bg-signal' : 'bg-foreground/80'}
                              />
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className={cn('mt-2 grid grid-cols-5 text-center', tick)}>
                  {YEARS.map((year) => (
                    <span key={year}>{year}</span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <table className="sr-only">
          <caption>{copy.b}</caption>
          <thead>
            <tr>
              <th scope="col">{copy.country}</th>
              {YEARS.map((year) => (
                <th key={year} scope="col">
                  {year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {f10b.map(([country, points]) => (
              <tr key={country}>
                <th scope="row">{country}</th>
                {YEARS.map((year) => (
                  <td key={year}>{valueAt(points, year) ?? copy.noValueShort}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
