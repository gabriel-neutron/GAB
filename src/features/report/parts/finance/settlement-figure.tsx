import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { useNarrowScreen } from '@/shared/narrow-screen';
import { type ReportBlock } from '../../content';
import publication from '../../data/publication-figures.json';
import { FigureFrame } from '../../figure-frame';
import { accent } from '../../primitives/accent';
import { layout } from '../../primitives/layout';
import { StickyScene } from '../../primitives/sticky-scene';
import { useContent } from '../../use-content';
import { ValuesTable } from '../ports-fleet/values-table';
import { settlementShare as value } from './settlement-shares';
import { useReduceMotion } from '../../reduced-motion';

type Pairs = readonly (readonly number[])[];
type Panel = 'exports' | 'imports';

const data = publication.f9;
const YEARS = (data.exports.Rouble as Pairs).map((pair) => pair[0] ?? 0);
const FIRST = YEARS[0] ?? 0;
const LAST = YEARS.at(-1) ?? 0;
const PANELS = ['exports', 'imports'] as const;

// The bands from the bottom up: the rouble (the accent), the other currencies, the "unfriendly"
// currencies. Each band has its own shape, so the chart reads without colour.
const SERIES = [
  { key: 'Rouble', labelKey: 'Rouble', fill: 'fill-signal/30', swatch: 'bg-signal/30' },
  {
    key: 'Other currencies',
    labelKey: 'Autres devises',
    fill: 'hatch',
    swatch: 'bg-[repeating-linear-gradient(45deg,var(--chart-axis)_0_1px,transparent_1px_5px)]',
  },
  {
    key: '“Unfriendly” currencies',
    labelKey: 'Devises de pays « inamicaux »',
    fill: 'dots',
    swatch:
      'bg-chart-neutral/30 bg-[radial-gradient(var(--chart-axis)_1px,transparent_1.5px)] bg-[length:5px_5px]',
  },
] as const;

const percent = (share: number | undefined) => (share === undefined ? '' : share.toFixed(1));

// The lower and upper edge of each band, year by year. A missing value is a data fault, not a
// share of zero, so it stops the build of the chart.
const edgesOf = (panel: Panel) => {
  let floor = YEARS.map(() => 0);
  return SERIES.map((series) => {
    const low = floor;
    const high = YEARS.map((one, index) => {
      const share = value(panel, series.key, one);
      if (share === undefined)
        throw new Error(`Figure 10: no ${series.key} ${panel} value for ${String(one)}`);
      return (low[index] ?? 0) + share;
    });
    floor = high;
    return { series, low, high };
  });
};
const EDGES = { exports: edgesOf('exports'), imports: edgesOf('imports') };

const PAD = { left: 34, right: 18, top: 10, bottom: 26 };

/** The width of a box in CSS pixels, so the chart draws its text at its true size. */
function useWidth() {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  // An adapter: the browser reports the size of the box past React.
  useEffect(() => {
    const node = box.current;
    if (node === null) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry?.contentRect.width ?? 0));
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);
  return [box, width] as const;
}

/** One panel of figure 10: the shares of the three groups of currencies as stacked bands. The years
 * after `year` stay under a veil. A mouse or a pen on a year calls `onPoint`. */
function SharePanel({
  panel,
  year,
  onPoint,
}: {
  readonly panel: Panel;
  readonly year: number;
  readonly onPoint: (year: number | null) => void;
}) {
  const labels = useContent().figureTexts.figures['9'].labels;
  const reduce = useReduceMotion();
  const narrow = useNarrowScreen();
  const hatch = useId();
  const dots = useId();
  const [box, W] = useWidth();
  const H = Math.round(narrow ? W * 0.7 : Math.min(W * 1.1, 460));
  const x = (one: number) =>
    PAD.left + ((one - FIRST) / (LAST - FIRST || 1)) * (W - PAD.left - PAD.right);
  const y = (share: number) => PAD.top + (1 - share / 100) * (H - PAD.top - PAD.bottom);
  const line = (edge: readonly number[]) =>
    YEARS.map((one, index) => `${String(x(one))},${String(y(edge[index] ?? 0))}`);
  const edges = EDGES[panel];
  const roubleEdge = edges[0]?.high ?? [];
  const at = YEARS.indexOf(year);
  const title = panel === 'exports' ? labels['a. Exportations'] : labels['b. Importations'];
  return (
    <div ref={box} className="min-w-0">
      <p className="font-mono text-report-label uppercase text-label">{title}</p>
      {W === 0 ? (
        <div style={{ aspectRatio: narrow ? '10 / 7' : '1 / 1' }} />
      ) : (
        <svg
          viewBox={`0 0 ${String(W)} ${String(H)}`}
          width={W}
          height={H}
          className="mt-2 block"
          aria-hidden="true"
          onPointerLeave={() => {
            onPoint(null);
          }}
        >
          <defs>
            <pattern
              id={hatch}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" className="fill-background" />
              <line x1="0" y1="0" x2="0" y2="6" className="stroke-chart-axis" strokeWidth="1" />
            </pattern>
            {/* A light tint with a dot grid, so the "unfriendly" band reads as data, not as ground. */}
            <pattern id={dots} width="5" height="5" patternUnits="userSpaceOnUse">
              <rect width="5" height="5" className="fill-chart-neutral" fillOpacity="0.3" />
              <circle cx="2.5" cy="2.5" r="0.9" className="fill-chart-axis" />
            </pattern>
          </defs>
          {edges.map(({ series, low, high }) => (
            <polygon
              key={series.key}
              points={[...line(high), ...line(low).reverse()].join(' ')}
              className={series.fill.startsWith('fill-') ? series.fill : undefined}
              fill={
                series.fill === 'hatch'
                  ? `url(#${hatch})`
                  : series.fill === 'dots'
                    ? `url(#${dots})`
                    : undefined
              }
            />
          ))}
          {/* The lower edge of the "unfriendly" band, so the three bands read as three series. */}
          <polyline
            points={line(edges[1]?.high ?? []).join(' ')}
            fill="none"
            strokeWidth="1"
            className="stroke-foreground/60"
          />
          {/* The grid lines cut the bands only: no grid outside the plot. */}
          {[25, 50, 75].map((tick) => (
            <line
              key={tick}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-background"
              strokeOpacity="0.7"
            />
          ))}
          <polyline
            points={line(roubleEdge).join(' ')}
            fill="none"
            strokeWidth="3"
            className={accent.stroke}
          />
          {[0, 25, 50, 75, 100].map((tick) => (
            <text
              key={tick}
              x={PAD.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-label font-mono text-report-label tabular-nums"
            >
              {tick}
            </text>
          ))}
          {YEARS.map((one) => (
            <text
              key={one}
              x={x(one)}
              y={H - 8}
              textAnchor="middle"
              className={cn(
                'font-mono text-report-label tabular-nums',
                one === year ? 'fill-foreground' : 'fill-label',
              )}
            >
              {`’${String(one).slice(2)}`}
            </text>
          ))}
          {/* The veil over the years after the step: it slides with a transform only. */}
          <motion.rect
            y={0}
            height={H - PAD.bottom}
            width={W}
            x={0}
            className="fill-background"
            fillOpacity="0.8"
            initial={false}
            animate={{ x: x(year) + 6 }}
            transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
          <line
            x1={x(year)}
            x2={x(year)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            className="stroke-foreground"
            strokeWidth="1"
          />
          <circle
            cx={x(year)}
            cy={y(roubleEdge[at] ?? 0)}
            r="5"
            className={cn(accent.fill, 'stroke-background')}
            strokeWidth="2"
          />
          {edges.map(({ series, low, high }) => {
            const share = value(panel, series.key, year);
            const middle = ((low[at] ?? 0) + (high[at] ?? 0)) / 2;
            if (share === undefined || share < 6) return null;
            return (
              <text
                key={series.key}
                x={x(year) - 9}
                y={y(middle) + 5}
                textAnchor="end"
                className={cn(
                  'fill-foreground stroke-background font-mono text-report-label tabular-nums',
                  series.key === 'Rouble' && 'font-semibold',
                )}
                paintOrder="stroke"
                strokeWidth="5"
                strokeLinejoin="round"
              >
                {percent(share)}
              </text>
            );
          })}
          {/* One zone for each year. A touch moves the page, so only a mouse or a pen inspects. */}
          {YEARS.map((one) => {
            const step = (W - PAD.left - PAD.right) / (YEARS.length - 1 || 1);
            return (
              <rect
                key={one}
                x={x(one) - step / 2}
                y={0}
                width={step}
                height={H}
                fill="transparent"
                onPointerEnter={(event) => {
                  if (event.pointerType !== 'touch') onPoint(one);
                }}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** The shares of one year: the year as an editorial numeral, the two rouble shares under it, and
 * the shares of the other groups of currencies. */
function YearReadout({ year, still }: { readonly year: number; readonly still: boolean }) {
  const { financeUi, figureTexts } = useContent();
  const copy = financeUi.figure;
  const labels = figureTexts.figures['9'].labels;
  return (
    <motion.div
      key={year}
      initial={still ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-end justify-between gap-4 lg:block"
    >
      <p
        className={cn(
          'font-mono text-report-number leading-[0.82] tracking-[-0.06em] tabular-nums',
          accent.text,
        )}
      >
        {year}
      </p>
      <div className="lg:mt-6">
        <p className="font-mono text-report-label uppercase text-label">{copy.stepLabel}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-5 lg:grid-cols-1 lg:gap-y-4">
          {PANELS.map((panel) => (
            <div key={panel}>
              <dt className="font-mono text-report-label uppercase text-label">{copy[panel]}</dt>
              <dd className="font-mono text-report-lead leading-none tracking-[-0.04em] tabular-nums">
                {percent(value(panel, 'Rouble', year))}%
              </dd>
              {/* On a phone the bands carry these values, so the readout stays short enough to stick. */}
              {SERIES.slice(1).map((series) => (
                <dd
                  key={series.key}
                  className="mt-1 hidden font-mono text-report-label tabular-nums text-label lg:block"
                >
                  {labels[series.labelKey]} {percent(value(panel, series.key, year))}%
                </dd>
              ))}
            </div>
          ))}
        </dl>
      </div>
    </motion.div>
  );
}

/** The chart of figure 10 at one year: the year in the gutter, then the legend and the exports
 * and imports side by side. A pointer on a year, or the focus on its button, shows that year in
 * place of the step. */
function SettlementChart({ year, still }: { readonly year: number; readonly still: boolean }) {
  const { financeUi, figureTexts } = useContent();
  const copy = financeUi.figure;
  const labels = figureTexts.figures['9'].labels;
  const describe = useId();
  // Three sources of the shown year, from the most to the least transient: the pointer on the
  // chart, the focus on a year button, and a year pinned by a click (a click does not focus a
  // button in every browser).
  const [pointed, setPointed] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const inspect = pointed ?? focused ?? pinned;
  const shown = inspect ?? year;
  return (
    <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <div>
        <YearReadout year={shown} still={still || inspect !== null} />
        <div
          role="group"
          aria-label={copy.inspect}
          className="mt-3 grid lg:mt-6"
          style={{ gridTemplateColumns: `repeat(${String(YEARS.length)}, minmax(0, 1fr))` }}
        >
          {YEARS.map((one) => (
            <button
              key={one}
              type="button"
              aria-describedby={`${describe}-${String(one)}`}
              aria-pressed={pinned === one}
              onFocus={() => {
                setFocused(one);
              }}
              onBlur={() => {
                setFocused(null);
              }}
              onClick={() => {
                setPinned((current) => (current === one ? null : one));
              }}
              className={cn(
                'min-h-6 font-mono text-report-label tabular-nums outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
                one === shown ? 'text-foreground underline underline-offset-4' : 'text-label',
              )}
            >
              {/* The name is the full year; the short year is what shows. */}
              <span aria-hidden="true">{`’${String(one).slice(2)}`}</span>
              <span className="sr-only">{one}</span>
              <span id={`${describe}-${String(one)}`} hidden>
                {PANELS.map(
                  (panel) =>
                    `${copy[panel]}: ${SERIES.map(
                      (series) =>
                        `${labels[series.labelKey]} ${percent(value(panel, series.key, one))}%`,
                    ).join(', ')}.`,
                ).join(' ')}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="min-w-0">
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-2 font-mono text-report-label">
              <span
                aria-hidden="true"
                className={cn('inline-block size-3 border border-chart-axis', series.swatch)}
              />
              {labels[series.labelKey]}
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-3 md:grid-cols-2 md:gap-8">
          {PANELS.map((panel) => (
            <SharePanel key={panel} panel={panel} year={shown} onPoint={setPointed} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Figure 10 as a scroll scene: the year and the chart stick together, and each step of the
 * scroll moves them to one year. Under reduced motion and on a phone, the final state at once. A
 * disclosure under the chart holds the full data as a table. */
export function SettlementFigure({
  block,
  partSlug,
}: {
  readonly block: ReportBlock;
  readonly partSlug: string;
}) {
  // On a phone the figure shows its final state too: no scroll step only moves the year.
  const narrowScreen = useNarrowScreen();
  const reduce = useReduceMotion() || narrowScreen;
  const { financeUi, figureTexts } = useContent();
  const copy = financeUi.figure;
  const labels = figureTexts.figures['9'].labels;
  const figure = block.figure;
  if (figure === undefined) return null;
  const frame = (chart: ReactNode) => (
    <FigureFrame
      number={figure.number}
      title={figure.title}
      unit={figure.unit}
      period={figure.period}
      sources={figure.sources}
      note={figureTexts.figures['9'].note}
      partSlug={partSlug}
    >
      {chart}
      {/* Under the chart and in the frame: the figure holds its data table, and an open table
          never covers the chart. */}
      <ValuesTable
        summary={copy.tableCaption}
        head={[
          copy.year,
          ...PANELS.flatMap((panel) =>
            SERIES.map((series) => `${copy[panel]}, ${labels[series.labelKey]}`),
          ),
        ]}
        rows={YEARS.map((one) => [
          String(one),
          ...PANELS.flatMap((panel) =>
            SERIES.map((series) => percent(value(panel, series.key, one))),
          ),
        ])}
      />
    </FigureFrame>
  );
  const chart = (year: number) => <SettlementChart year={year} still={reduce} />;
  // The step text repeats the readout of the chart for a screen reader; the chart shows it.
  const steps = copy.steps.map((year) => (
    <p key={year}>
      {year}. {copy.stepLabel}:{' '}
      {PANELS.map((panel) => `${copy[panel]} ${percent(value(panel, 'Rouble', year))}%`).join(', ')}
      .
    </p>
  ));
  return (
    <div className={layout.bleed}>
      <div className="mx-auto max-w-[1440px] px-4 md:px-8 lg:px-12">
        {/* Only the chart sticks: the frame, its facts and its table scroll with the page, as in
            figure 4. */}
        {frame(
          reduce ? (
            chart(LAST)
          ) : (
            <StickyScene steps={steps} stepClassName="sr-only">
              {(active) => chart(copy.steps[active] ?? LAST)}
            </StickyScene>
          ),
        )}
      </div>
    </div>
  );
}
