import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { useNarrowScreen } from '@/shared/narrow-screen';
import { financeUi, figureTexts, type ReportBlock } from '../../content';
import publication from '../../data/publication-figures.json';
import { FigureFrame } from '../../figure-frame';
import { accent } from '../../primitives/accent';
import { layout } from '../../primitives/layout';
import { StickyScene } from '../../primitives/sticky-scene';

type Pairs = readonly (readonly number[])[];
type Panel = 'exports' | 'imports';

const copy = financeUi.figure;
const labels = figureTexts.figures['9'].labels;
const data = publication.f9;
const YEARS = (data.exports.Rouble as Pairs).map((pair) => pair[0] ?? 0);
const FIRST = YEARS[0] ?? 0;
const LAST = YEARS.at(-1) ?? 0;
const PANELS = ['exports', 'imports'] as const;

// The bands from the bottom up: the rouble (the accent), the other currencies, the "unfriendly"
// currencies. Each band has its own shape, so the chart reads without colour.
const SERIES = [
  { key: 'Rouble', label: labels.Rouble, fill: 'fill-signal/30', swatch: 'bg-signal/30' },
  {
    key: 'Other currencies',
    label: labels['Autres devises'],
    fill: 'hatch',
    swatch: 'bg-[repeating-linear-gradient(45deg,var(--chart-axis)_0_1px,transparent_1px_5px)]',
  },
  {
    key: '“Unfriendly” currencies',
    label: labels['Devises de pays « inamicaux »'],
    fill: 'dots',
    swatch:
      'bg-chart-neutral/30 bg-[radial-gradient(var(--chart-axis)_1px,transparent_1.5px)] bg-[length:5px_5px]',
  },
] as const;

const value = (panel: Panel, key: string, year: number): number | undefined => {
  const pairs = (data[panel] as Readonly<Record<string, Pairs>>)[key];
  return pairs?.find((pair) => pair[0] === year)?.[1];
};
const percent = (share: number | undefined) => (share === undefined ? '' : share.toFixed(1));

// The lower and upper edge of each band, year by year. A missing value stays a gap of zero.
const edgesOf = (panel: Panel) => {
  let floor = YEARS.map(() => 0);
  return SERIES.map((series) => {
    const low = floor;
    const high = YEARS.map(
      (one, index) => (low[index] ?? 0) + (value(panel, series.key, one) ?? 0),
    );
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

/** One panel of figure 9: the shares of the three groups of currencies as stacked bands. The years
 * after `year` stay under a veil. */
function SharePanel({ panel, year }: { readonly panel: Panel; readonly year: number }) {
  const reduce = useReducedMotion();
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
      <p className="font-mono text-caption uppercase text-label">{title}</p>
      {W === 0 ? (
        <div style={{ aspectRatio: narrow ? '10 / 7' : '1 / 1' }} />
      ) : (
        <svg
          viewBox={`0 0 ${String(W)} ${String(H)}`}
          width={W}
          height={H}
          className="mt-2 block"
          aria-hidden="true"
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
              className="fill-label font-mono text-[12px] tabular-nums"
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
                'font-mono text-[12px] tabular-nums',
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
            transition={
              reduce === true ? { duration: 0 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
            }
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
                  'fill-foreground stroke-background font-mono text-[13px] tabular-nums',
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
        </svg>
      )}
    </div>
  );
}

/** The rouble shares of one year, set as an editorial numeral with the two values under it. */
function YearReadout({ year, still }: { readonly year: number; readonly still: boolean }) {
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
          'font-mono text-[clamp(3rem,7vw,7rem)] leading-[0.82] tracking-[-0.06em] tabular-nums',
          accent.text,
        )}
      >
        {year}
      </p>
      <div className="lg:mt-6">
        <p className="font-mono text-caption uppercase text-label">{copy.stepLabel}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-5 lg:grid-cols-1 lg:gap-y-4">
          {PANELS.map((panel) => (
            <div key={panel}>
              <dt className="font-mono text-caption uppercase text-label">{copy[panel]}</dt>
              <dd className="font-mono text-[clamp(1.75rem,3.2vw,3rem)] leading-none tracking-[-0.04em] tabular-nums">
                {percent(value(panel, 'Rouble', year))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </motion.div>
  );
}

/** The chart of figure 9 at one year: the year in the gutter, then the legend and the exports
 * and imports side by side. */
function SettlementChart({ year, still }: { readonly year: number; readonly still: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
      <YearReadout year={year} still={still} />
      <div className="min-w-0">
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {SERIES.map((series) => (
            <li key={series.key} className="flex items-center gap-2 font-mono text-data">
              <span
                aria-hidden="true"
                className={cn('inline-block size-3 border border-chart-axis', series.swatch)}
              />
              {series.label}
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-3 md:grid-cols-2 md:gap-8">
          {PANELS.map((panel) => (
            <SharePanel key={panel} panel={panel} year={year} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Figure 9 as a scroll scene: the frame, the year and the chart stick together as one unit, and
 * each step of the scroll moves them to one year. Under reduced motion the figure shows its final
 * state at once. A screen reader gets the full data as a table. */
export function SettlementFigure({
  block,
  partSlug,
}: {
  readonly block: ReportBlock;
  readonly partSlug: string;
}) {
  const reduce = useReducedMotion() === true;
  const narrow = useNarrowScreen();
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
    </FigureFrame>
  );
  const chart = (year: number) => <SettlementChart year={year} still={reduce} />;
  // The step text repeats the readout of the chart for a screen reader; the chart shows it.
  const steps = copy.steps.map((year) => (
    <p key={year}>
      {year}. {copy.stepLabel}:{' '}
      {PANELS.map((panel) => `${copy[panel]} ${percent(value(panel, 'Rouble', year))}`).join(', ')}.
    </p>
  ));
  return (
    <div className={layout.bleed}>
      <div className="mx-auto max-w-[1440px] px-4 md:px-8 lg:px-12">
        {/* On a wide screen the frame sticks with the chart; on a phone it is too tall for the
            view, so only the chart sticks. */}
        {reduce ? (
          frame(chart(LAST))
        ) : narrow ? (
          frame(
            <StickyScene steps={steps} stepClassName="sr-only">
              {(active) => chart(copy.steps[active] ?? LAST)}
            </StickyScene>,
          )
        ) : (
          <StickyScene steps={steps} stepClassName="sr-only">
            {(active) => frame(chart(copy.steps[active] ?? LAST))}
          </StickyScene>
        )}
        <table className="sr-only">
          <caption>{copy.tableCaption}</caption>
          <thead>
            <tr>
              <th scope="col">{copy.year}</th>
              {PANELS.flatMap((panel) =>
                SERIES.map((series) => (
                  <th key={`${panel}-${series.key}`} scope="col">
                    {copy[panel]}, {series.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {YEARS.map((one) => (
              <tr key={one}>
                <th scope="row">{one}</th>
                {PANELS.flatMap((panel) =>
                  SERIES.map((series) => (
                    <td key={`${panel}-${series.key}`}>{percent(value(panel, series.key, one))}</td>
                  )),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
