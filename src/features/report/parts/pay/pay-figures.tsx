import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { figureTexts, payUi } from '../../content';
import { NodeRef } from '../../node-ref';
import { useContent } from '../../use-content';
import { FADE, GLYPH, LineChart, type LineSeries, type Scales } from './line-chart';
import {
  buyerYears,
  crossing,
  monthIndex,
  monthName,
  payData,
  valuesInYear,
  type Point,
} from './pay-data';

const PANEL_TITLE = 'font-mono text-report-label uppercase text-label';
const LEGEND = 'mt-2 font-mono text-report-label/4 text-label';
const INVASION = 2022.15;
const year = (x: number) => String(x);
const ticks = (from: number, to: number, every: number) =>
  Array.from({ length: Math.floor((to - from) / every) + 1 }, (_, index) => ({
    at: from + index * every,
    label: String(from + index * every),
  }));

/** A dated rule on the time axis, with its label at the top. */
function EventRule({ at, label, scales }: { at: number; label: string; scales: Scales }) {
  const x = scales.x(at);
  return (
    <g>
      <line
        x1={x}
        x2={x}
        y1={scales.top}
        y2={scales.bottom}
        strokeDasharray="2 3"
        className="stroke-chart-axis"
      />
      <text x={x + 4} y={scales.top + 10} className="fill-label">
        {label}
      </text>
    </g>
  );
}

// Figure 3 ----------------------------------------------------------------------------------

const f3 = figureTexts.figures['3'];
const f3Names: Record<string, string> = {
  Coalition: f3.labels.Coalition,
  China: f3.labels.Chine,
  India: f3.labels.Inde,
  Turkey: f3.labels.Turquie,
  Kazakhstan: f3.labels.Kazakhstan,
  EU27: f3.labels.UE,
};
// The first and the last year of a panel that hold a value.
const span = (rows: readonly { readonly points: readonly Point[] }[]) => {
  const years = rows.flatMap((row) => row.points.flatMap((point) => (point ? [point.x] : [])));
  return [Math.min(...years), Math.max(...years)] as const;
};
// The accent marks China only, the main point; India is the second step, a tint of the ink.
const f3Tone = (key: string): LineSeries['tone'] =>
  key === 'China'
    ? 'accent'
    : key === 'India'
      ? 'tint'
      : key === 'Coalition' || key === 'EU27'
        ? 'ink'
        : 'faint';

/** A ring where line `a` goes below line `b`, with its label. A label sits above its ring, or
 * hangs below it when the panel has two; with `lead`, it goes up into the clear top band of the
 * plot on a leader line, clear of the context lines near the axis. */
function Crossings({
  rows,
  pairs,
  scales,
}: {
  rows: readonly { key: string; points: readonly Point[] }[];
  pairs: readonly { readonly a: string; readonly b: string; readonly lead?: boolean }[];
  scales: Scales;
}) {
  const line = (key: string) => rows.find((row) => row.key === key)?.points ?? [];
  // A leader line goes under the other labels: their halo cuts it where they cross.
  const order = pairs
    .map((pair, index) => ({ ...pair, index }))
    .toSorted((one, two) => Number(two.lead ?? false) - Number(one.lead ?? false));
  return (
    <>
      {order.map(({ a, b, lead = false, index }) => {
        const at = crossing(line(a), line(b));
        if (at === undefined) return null;
        const x = scales.x(at.x);
        const y = scales.y(at.y);
        const text = payUi.crossing.replace('{a}', f3Names[a] ?? a).replace('{b}', f3Names[b] ?? b);
        const width = text.length * GLYPH;
        const top = scales.top + 28;
        const label = lead
          ? {
              x: Math.min(Math.max(x - width / 2, scales.left), scales.right - width),
              y: top,
              anchor: 'start' as const,
            }
          : {
              x: x + (index === 0 ? 9 : -9),
              y: y + (index === 0 ? -9 : 18),
              anchor: index === 0 ? ('start' as const) : ('end' as const),
            };
        return (
          <g key={`${a}-${b}`}>
            <circle cx={x} cy={y} r={6} strokeWidth={1.5} className="fill-none stroke-foreground" />
            {lead ? (
              <line x1={x} x2={x} y1={y - 6} y2={top + 5} className="stroke-foreground" />
            ) : null}
            <text
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              strokeWidth={4}
              paintOrder="stroke"
              className="fill-foreground stroke-background"
            >
              {text}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** Figure 3: two panels side by side, the buyers in dollars and the crude in tonnes. The new
 * buyers carry the accent; an estimate is a hollow point, and an estimated series is dashed. */
export function BuyersChart() {
  const copy = useContent().payUi;
  const [chosen, setChosen] = useState(buyerYears.at(-1) ?? 0);
  const [a, b] = f3.panels;
  const panels = [
    {
      title: a?.title ?? '',
      unit: a?.unit ?? '',
      x: span(payData.f3a),
      // Room above the top tick for the label on its leader line.
      y: [0, 340] as const,
      yTicks: [0, 100, 200, 300],
      rows: payData.f3a,
      pairs: [
        { a: 'Coalition', b: 'China' },
        { a: 'Coalition', b: 'India', lead: true },
      ],
    },
    {
      title: b?.title ?? '',
      unit: b?.unit ?? '',
      x: span(payData.f3b),
      y: [0, 120] as const,
      yTicks: [0, 40, 80, 120],
      rows: payData.f3b,
      pairs: [
        { a: 'EU27', b: 'China' },
        { a: 'EU27', b: 'India' },
      ],
    },
  ];
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-8">
      <div className="flex items-center gap-4 font-mono text-report-label md:col-span-2">
        <span aria-hidden="true" className="uppercase text-label">
          {copy.year}
        </span>
        <input
          type="range"
          aria-label={copy.year}
          min={buyerYears[0]}
          max={buyerYears.at(-1)}
          step={1}
          value={chosen}
          onChange={(event) => {
            setChosen(Number(event.target.value));
          }}
          className="h-11 min-w-0 flex-1 cursor-pointer accent-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
        />
        <output aria-hidden="true" className="text-report-lead tabular-nums">
          {chosen}
        </output>
      </div>
      {panels.map((panel) => (
        <div key={panel.title} className="min-w-0">
          <p className={PANEL_TITLE}>{panel.title}</p>
          {/* The values of the chosen year, next to the scrubber. */}
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 font-mono text-report-label tabular-nums">
            {valuesInYear(panel.rows, chosen).map(({ key, point }) => (
              <div key={key} className="contents">
                <dt className="border-b border-divider py-1 text-label">{f3Names[key] ?? key}</dt>
                <dd className="border-b border-divider py-1 text-right">
                  {point === null ? '' : point.y.toFixed(0)}
                  {point?.hollow === true ? ` (${copy.estimated})` : ''}
                </dd>
              </div>
            ))}
          </dl>
          <div className="mt-3">
            <LineChart
              tableLabel={copy.table}
              spec={{
                label: panel.title,
                unit: panel.unit,
                x: panel.x,
                y: panel.y,
                xTicks: ticks(panel.x[0], panel.x[1], 1),
                yTicks: panel.yTicks,
                xName: year,
                series: panel.rows.map((row) => ({
                  id: row.key,
                  label: f3Names[row.key] ?? row.key,
                  tone: f3Tone(row.key),
                  points: row.points,
                  dashed: row.points.every((point) => point?.hollow === true),
                })),
              }}
              layers={(scales) => ({
                under: (
                  <>
                    <EventRule at={INVASION} label={f3.labels.invasion} scales={scales} />
                    {/* The cursor of the scrubber: it slides to the year, and hides before the
                        first year of the panel. */}
                    <line
                      x1={0}
                      x2={0}
                      y1={scales.top}
                      y2={scales.bottom}
                      strokeWidth={1.5}
                      style={{ transform: `translateX(${String(scales.x(chosen))}px)` }}
                      className={cn(
                        'stroke-signal transition-[transform,opacity] duration-200 motion-reduce:transition-none',
                        chosen < panel.x[0] ? 'opacity-0' : 'opacity-100',
                      )}
                    />
                  </>
                ),
                over: <Crossings rows={panel.rows} pairs={panel.pairs} scales={scales} />,
              })}
            />
          </div>
        </div>
      ))}
      <p className={cn(LEGEND, 'md:col-span-2')}>{payUi.estimate}</p>
      <p className={cn(LEGEND, 'md:col-span-2')}>{payUi.crossingNote}</p>
    </div>
  );
}

// Figure 4 ----------------------------------------------------------------------------------

const f4 = payData.f4;
const f4Labels = figureTexts.figures['4'].labels;
// The first month of each year of the axis.
const firstYearAt = Array.from({ length: Math.floor((f4.last - 1) / 12) + 1 }, (_, index) =>
  monthIndex(`${String(2023 + index)}-01`),
);
// The groups that step 3 names, read from its text.
const designated = [...payUi.f4.steps[2].text.matchAll(/\[\[(N-[^|\]]+)\|/g)].map(
  (match) => match[1] ?? '',
);

/** The gap between Brent and Urals as an area, one shape for each run of months that has both. */
function gapPath(scales: Scales): string {
  const runs: { brent: NonNullable<Point>; urals: NonNullable<Point> }[][] = [[]];
  f4.brent.forEach((brent, index) => {
    const urals = f4.urals[index];
    if (brent !== null && urals !== null && urals !== undefined)
      runs.at(-1)?.push({ brent, urals });
    else runs.push([]);
  });
  return runs
    .filter((run) => run.length > 1)
    .map((run) => {
      const top = run.map(
        ({ brent }) => `${scales.x(brent.x).toFixed(1)},${scales.y(brent.y).toFixed(1)}`,
      );
      const low = run
        .toReversed()
        .map(({ urals }) => `${scales.x(urals.x).toFixed(1)},${scales.y(urals.y).toFixed(1)}`);
      return `M${top.join('L')}L${low.join('L')}Z`;
    })
    .join('');
}

/** The point of the chart that each step of the scene speaks of: the first cap, the lowered cap,
 * and Urals in the month of the designation. */
function focusPoint(step: number): { x: number; y: number } | undefined {
  if (step === 1 || step === 2) {
    const cap = f4.caps[step - 1];
    return cap === undefined ? undefined : { x: cap.x, y: cap.value };
  }
  if (step === 3) {
    // The month that holds the date: the 22nd of October is October.
    const urals = f4.urals[Math.floor(f4.event)];
    return urals === null || urals === undefined ? undefined : { x: urals.x, y: urals.y };
  }
  return undefined;
}

/** Figure 4 at one step of its scene: 0 the two prices, 1 the first cap, 2 the lower caps, 3 the
 * gap and the designation of Rosneft and Lukoil. With `focus`, a ring marks the point of the step.
 * The two designated groups stand in a row above the plot, clear of the data. */
export function PriceChart({
  step,
  focus = false,
  fill = false,
  whatIf,
}: {
  readonly step: number;
  readonly focus?: boolean;
  readonly fill?: boolean;
  /** A what-if line across all months, with its label; the three real caps stay. */
  readonly whatIf?: { readonly value: number; readonly label: string };
}) {
  const [first, ...lower] = f4.caps;
  const point = focus ? focusPoint(step) : undefined;
  return (
    <div className={cn('flex flex-col', fill && 'h-full')}>
      {/* The row keeps its place at each step, so the chart does not move when it shows. */}
      <p
        className={cn(
          FADE,
          'flex flex-wrap items-center gap-x-3 font-mono text-report-label',
          // The glyphs take the ink: the accent of the page stays on the caps and the gap.
          '[&_svg_*]:stroke-foreground [&_svg_*:not([fill=none])]:fill-foreground',
          step >= 3 ? 'opacity-100' : 'invisible opacity-0',
        )}
      >
        <span className="text-report-label/4 text-label">
          {f4Labels['Rosneft et Lukoil désignés']}
        </span>
        {designated.map((id) => (
          <span key={id} className="inline-flex min-h-11 items-center">
            <NodeRef id={id} />
          </span>
        ))}
      </p>
      <div className={cn('min-w-0', fill && 'min-h-0 flex-1')}>
        <LineChart
          fill={fill}
          spec={{
            // The second chart, with the what-if line, gets its own name.
            label: whatIf === undefined ? payUi.f4.label : `${payUi.f4.label}, ${whatIf.label}`,
            unit: figureTexts.figures['4'].panels[0]?.unit ?? '',
            x: [0, f4.last],
            y: [0, 125],
            xTicks: firstYearAt.map((at) => ({ at, label: String(2022 + Math.ceil(at / 12)) })),
            yTicks: [0, 25, 50, 75, 100, 125],
            xName: monthName,
            digits: 1,
            series: [
              { id: 'brent', label: f4Labels.Brent, tone: 'muted', points: f4.brent },
              { id: 'urals', label: f4Labels.Oural, tone: 'ink', points: f4.urals },
            ],
          }}
          layers={(scales) => {
            const capLine = (from: number, to: number, value: number) =>
              `M${scales.x(from).toFixed(1)},${scales.y(value).toFixed(1)}H${scales.x(to).toFixed(1)}`;
            const ends = [...f4.caps.slice(1).map((cap) => cap.x), f4.last];
            const event = scales.x(f4.event);
            return {
              under: (
                <>
                  <path
                    d={gapPath(scales)}
                    className={cn(FADE, 'fill-signal', step >= 3 ? 'opacity-25' : 'opacity-0')}
                  />
                  <text x={scales.x(1)} y={scales.y(8) - 6} className="fill-label">
                    <tspan x={scales.x(1)}>{f4Labels['prix de l’Oural non publié']}</tspan>
                    <tspan x={scales.x(1)} dy={16}>
                      {f4Labels['pour dix mois de 2023']}
                    </tspan>
                  </text>
                </>
              ),
              over: (
                <>
                  {[first, ...lower].map((cap, index) =>
                    cap === undefined ? null : (
                      <g
                        key={cap.x}
                        className={cn(
                          FADE,
                          step >= (index === 0 ? 1 : 2) ? 'opacity-100' : 'opacity-0',
                        )}
                      >
                        <path
                          d={capLine(cap.x, ends[index] ?? f4.last, cap.value)}
                          strokeWidth={2}
                          strokeDasharray="10 4"
                          className="stroke-signal"
                        />
                        {/* The label of the short middle cap sits left of its line, clear of the next. */}
                        <text
                          // Clear of the ring that marks the cap in its step.
                          x={scales.x(cap.x) + (index === 1 ? -16 : 14)}
                          y={scales.y(cap.value) + (index === 1 ? 4 : 14)}
                          textAnchor={index === 1 ? 'end' : 'start'}
                          className="fill-signal"
                        >
                          {f4Labels['plafond {v} $'].replace('{v}', String(cap.value))}
                        </text>
                      </g>
                    ),
                  )}
                  <g className={cn(FADE, step >= 3 ? 'opacity-100' : 'opacity-0')}>
                    <line
                      x1={event}
                      x2={event}
                      y1={scales.top}
                      y2={scales.bottom}
                      strokeDasharray="2 3"
                      className="stroke-foreground"
                    />
                  </g>
                  {whatIf === undefined ? null : (
                    <g>
                      <path
                        d={capLine(0, f4.last, whatIf.value)}
                        strokeWidth={1.5}
                        className="stroke-foreground"
                      />
                      {/* At the left end, clear of the end labels; the halo keeps it legible over a line. */}
                      <text
                        x={scales.left + 4}
                        y={scales.y(whatIf.value) - 6}
                        strokeWidth={4}
                        paintOrder="stroke"
                        className="fill-foreground stroke-background"
                      >
                        {whatIf.label}
                      </text>
                    </g>
                  )}
                  {point === undefined ? null : (
                    <g key={step}>
                      <circle
                        cx={scales.x(point.x)}
                        cy={scales.y(point.y)}
                        r={8}
                        strokeWidth={1.5}
                        className="fill-none stroke-signal"
                      />
                    </g>
                  )}
                </>
              ),
            };
          }}
        />
      </div>
    </div>
  );
}

// Figure 5 ----------------------------------------------------------------------------------

const f5 = figureTexts.figures['5'];
const f5Data = payData.f5;
const facts = (points: readonly Point[]) => points.map((point) => (point?.hollow ? null : point));
const plans = (points: readonly Point[]) => points.map((point) => (point?.hollow ? point : null));

/** Figure 5: the share of oil and gas in revenue, and the revenue against defence. The
 * January-September values and the planned budgets are hollow points; 2023 has no figure. */
export function BudgetChart() {
  const [a, b] = f5.panels;
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-8">
      <div className="min-w-0">
        <p className={PANEL_TITLE}>{a?.title}</p>
        <div className="mt-3">
          <LineChart
            spec={{
              label: a?.title ?? '',
              unit: a?.unit ?? '',
              x: [2014, 2026],
              y: [0, 60],
              xTicks: ticks(2014, 2026, 4),
              yTicks: [0, 20, 40, 60],
              xName: year,
              digits: 1,
              series: [
                {
                  id: 'share',
                  label: f5.labels['année entière'],
                  tone: 'accent',
                  points: f5Data.share,
                },
                {
                  id: 'share9',
                  label: f5.labels['janv.-sept.'],
                  tone: 'ink',
                  points: f5Data.share9,
                  dashed: true,
                },
              ],
            }}
            layers={(scales) => ({
              under: <EventRule at={INVASION} label={f5.labels.invasion} scales={scales} />,
            })}
          />
        </div>
        <p className={LEGEND}>{f5.labels['janvier-septembre (2026 provisoire)']}</p>
      </div>
      <div className="min-w-0">
        <p className={PANEL_TITLE}>{b?.title}</p>
        <div className="mt-3">
          <LineChart
            spec={{
              label: b?.title ?? '',
              unit: b?.unit ?? '',
              x: [2014, 2025],
              y: [0, 12],
              xTicks: ticks(2014, 2025, 4),
              yTicks: [0, 4, 8, 12],
              xName: year,
              digits: 1,
              series: [
                {
                  id: 'revenue',
                  label: f5.labels['Pétrole et gaz'],
                  tone: 'ink',
                  points: f5Data.revenue,
                },
                {
                  id: 'defence',
                  label: f5.labels.Défense,
                  tone: 'accent',
                  points: facts(f5Data.defence),
                },
                {
                  id: 'defence-plan',
                  label: f5.labels['Défense (prévu)'],
                  tone: 'accent',
                  points: plans(f5Data.defence),
                  dashed: true,
                },
              ],
            }}
            layers={(scales) => ({
              under: (
                <>
                  <EventRule at={INVASION} label={f5.labels.invasion} scales={scales} />
                  <text
                    x={scales.x(2023)}
                    y={scales.bottom - 8}
                    textAnchor="middle"
                    className="fill-label"
                  >
                    {f5.labels['2023 : pas de chiffre']}
                  </text>
                </>
              ),
            })}
          />
        </div>
        <p className={LEGEND}>{f5.labels['point vide : budget prévu ; 2022 d’après Reuters']}</p>
      </div>
    </div>
  );
}
