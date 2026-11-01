import { useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { accent } from '../../primitives/accent';
import { useContent } from '../../use-content';
import { useReport } from '../../use-report';
import { chartLayout } from './chart-layout';
import { figureData } from './figure-data';
import { useSize } from './use-size';
import { ValuesTable } from './values-table';

const DRAW = { duration: 0.6, ease: [0.4, 0, 0.2, 1] } as const;

// The ports of figure 6a and the nodes of the report they name. Primorsk is the one port that the
// text and figure 6b show rising in 2026; it takes the accent.
const PORT_NODES: Readonly<Record<string, string>> = {
  Primorsk: 'N-P001',
  'Ust-Luga': 'N-P002',
  'Novorossiysk (incl. CPC)': 'N-P005',
  Tuapse: 'N-P011',
};
const LEAD = 'Primorsk';
const CRUDE = 'All ports: crude oil';

/** The words of figure 6 in the page locale: its panels, its labels (a French label of the
 * publication, or a name of the data), the words of panel c and the number format. */
function useFigure() {
  const { figureTexts, portsFleetUi, ui } = useContent();
  const texts = figureTexts.figures['6'];
  const labels: Readonly<Partial<Record<string, string>>> = texts.labels;
  const [panelA, panelB] = texts.panels;
  const number = new Intl.NumberFormat(ui.numberLocale);
  const fleetLabels: Readonly<Partial<Record<string, string>>> = {
    shadow: labels['« Flotte fantôme »'] ?? '',
    ig: labels['Assurés IG'] ?? '',
  };
  return { labels, panelA, panelB, number, copy: portsFleetUi.traffic, fleetLabels };
}

/** Figure 6: the traffic of the oil ports by year, their change in early 2026, and seaborne crude
 * by fleet category by month. A port line or its name opens the record of the port. */
export function PortTraffic() {
  const { panelA, panelB, number, copy, fleetLabels } = useFigure();
  return (
    <div className="grid gap-x-10 gap-y-12 lg:grid-cols-12">
      <Panel
        title={`${panelA?.id ?? ''}. ${panelA?.title ?? ''}`}
        unit={panelA?.unit ?? ''}
        className="lg:col-span-7"
      >
        <TrafficLines />
        <ValuesTable
          head={['', ...YEARS.map(String)]}
          rows={figureData.traffic.map((one) => [
            one.name,
            ...one.points.map((point) => number.format(point.value)),
          ])}
        />
      </Panel>
      <Panel
        title={`${panelB?.id ?? ''}. ${panelB?.title ?? ''}`}
        unit={panelB?.unit ?? ''}
        className="lg:col-span-5"
      >
        <ChangeBars />
      </Panel>
      <Panel title={copy.cTitle} unit={copy.cUnit} className="lg:col-span-12">
        <FleetLines />
        <ValuesTable
          head={['', ...figureData.fleet.map((one) => fleetLabels[one.key] ?? one.key)]}
          rows={MONTHS.map((month, index) => [
            month,
            ...figureData.fleet.map((one) => number.format(one.points[index]?.value ?? 0)),
          ])}
        />
      </Panel>
    </div>
  );
}

interface PanelProps {
  readonly title: string;
  readonly unit: string;
  readonly className: string;
  readonly children: ReactNode;
}

function Panel({ title, unit, className, children }: PanelProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="font-mono text-report-label uppercase text-foreground">{title}</p>
      <p className="mb-4 font-mono text-report-label uppercase text-label">{unit}</p>
      {children}
    </div>
  );
}

const YEARS = figureData.traffic[0]?.points.map((point) => point.year) ?? [];
// The value axis of figure 6a: the data range, out to whole tens.
const allValues = figureData.traffic.flatMap((one) => one.points.map((point) => point.value));
const LOW = Math.floor(Math.min(...allValues) / 10) * 10;
const HIGH = Math.ceil(Math.max(...allValues) / 10) * 10;
const VALUE_TICKS = Array.from({ length: (HIGH - LOW) / 10 + 1 }, (_, index) => LOW + index * 10);

// The ticks of the years at a regular step, clear of the embargo rule at December 2022: every two
// years, with 2025 when a year has 40px, and every four years from 2016 on a narrow chart.
const years = (yearWidth: number) =>
  yearWidth < 24
    ? [2016, 2020, 2024]
    : [2014, 2016, 2018, 2020, 2022, 2024, ...(yearWidth >= 40 ? [2025] : [])];

// The top pad holds the label of the embargo rule, above the plot.
const PAD = { left: 34, right: 160, top: 30, bottom: 28 };

function TrafficLines() {
  const box = useRef<HTMLDivElement>(null);
  const { width } = useSize(box);
  const { openNode } = useReport();
  const { labels, panelA, number, copy } = useFigure();
  const height = 340;
  const x = (year: number) =>
    PAD.left + ((year - 2014) / 11) * Math.max(1, width - PAD.left - PAD.right);
  const y = (value: number) =>
    PAD.top + ((HIGH - value) / (HIGH - LOW)) * (height - PAD.top - PAD.bottom);
  const series = [...figureData.traffic].sort(
    (a, b) => Number(a.name === LEAD) - Number(b.name === LEAD),
  );
  const ends = figureData.traffic.map((one) => ({ name: one.name, last: one.points.at(-1) }));
  const placed = [...ends].sort((a, b) => y(a.last?.value ?? 0) - y(b.last?.value ?? 0));
  const spots = chartLayout.spread(
    placed.map((one) => y(one.last?.value ?? 0)),
    18,
    PAD.top,
    height - PAD.bottom,
  );
  const embargo = 2022 + 11 / 12;
  // The label stands at the rule: left of it when it fits there, right of it on a narrow chart.
  const embargoLabel = `${labels['embargo de l’UE'] ?? ''} · ${copy.embargoDate}`;
  // On a phone neither side holds it: it ends at the right edge, over the rule, with a halo.
  const labelWidth = embargoLabel.length * 8.1;
  const leftOfRule = x(embargo) - 6 - labelWidth >= 0;
  const rightOfRule = x(embargo) + 6 + labelWidth <= width;
  const embargoAt = leftOfRule
    ? { x: x(embargo) - 6, anchor: 'end' as const }
    : rightOfRule
      ? { x: x(embargo) + 6, anchor: 'start' as const }
      : { x: width, anchor: 'end' as const };
  return (
    <div ref={box}>
      {width === 0 ? (
        <div style={{ height }} />
      ) : (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={panelA?.title ?? ''}
          className="block"
        >
          {VALUE_TICKS.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 100 ? 'stroke-chart-axis' : 'stroke-chart-grid'}
                strokeDasharray={tick === 100 ? '3 3' : undefined}
              />
              <text
                x={PAD.left - 6}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-label font-mono text-report-label"
              >
                {tick}
              </text>
            </g>
          ))}
          {years(x(2015) - x(2014)).map((year) => (
            <text
              key={year}
              x={x(year)}
              y={height - 8}
              textAnchor="middle"
              className="fill-label font-mono text-report-label tabular-nums"
            >
              {year}
            </text>
          ))}
          <line
            x1={x(embargo)}
            x2={x(embargo)}
            y1={6}
            y2={height - PAD.bottom}
            className="stroke-foreground"
            strokeWidth={1}
          />
          <text
            x={embargoAt.x}
            y={16}
            textAnchor={embargoAt.anchor}
            strokeWidth={4}
            paintOrder="stroke"
            className="fill-foreground stroke-background font-mono text-report-label uppercase"
          >
            {embargoLabel}
          </text>
          {series.map((one) => {
            const lead = one.name === LEAD;
            const id = PORT_NODES[one.name];
            return (
              <motion.path
                key={one.name}
                // The rows of panel B open the same records by keyboard.
                onClick={() => {
                  if (id !== undefined) openNode(id);
                }}
                d={one.points
                  .map(
                    (point, index) =>
                      `${index === 0 ? 'M' : 'L'}${x(point.year)},${y(point.value)}`,
                  )
                  .join('')}
                fill="none"
                strokeWidth={lead ? 2.5 : 1.5}
                className={cn('cursor-pointer', lead ? accent.stroke : 'stroke-chart-neutral')}
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={DRAW}
              />
            );
          })}
          {placed.map((one, index) => {
            const last = one.last;
            if (last === undefined) return null;
            const spot = spots[index] ?? 0;
            return (
              <g key={one.name}>
                <line
                  x1={x(last.year) + 3}
                  x2={width - PAD.right + 6}
                  y1={y(last.value)}
                  y2={spot}
                  className="stroke-chart-grid"
                />
                <text
                  x={width - PAD.right + 10}
                  y={spot + 4}
                  className={cn(
                    'font-mono text-report-label',
                    one.name === LEAD ? accent.fill : 'fill-foreground',
                  )}
                >
                  {(labels[one.name] ?? one.name).replace(/ \((incl\.|avec) CPC\)/, '')}{' '}
                  {number.format(last.value)}
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

function ChangeBars() {
  const { openNode } = useReport();
  const { labels } = useFigure();
  const rows = figureData.change;
  const extent = Math.max(...rows.map((row) => Math.abs(row.value)));
  return (
    <ul className="grid gap-y-3">
      {rows.map((row) => {
        const share = (Math.abs(row.value) / extent) * 50;
        const lead = row.name === CRUDE;
        const id = PORT_NODES[row.name];
        const name = labels[row.name] ?? row.name;
        return (
          <li
            key={row.name}
            className="relative grid min-w-0 grid-cols-1 items-center gap-x-3 sm:grid-cols-[12.5rem_5.5rem_minmax(0,1fr)]"
          >
            {id === undefined ? (
              <span
                className={cn(
                  'font-mono text-report-label sm:whitespace-nowrap',
                  lead ? accent.text : 'text-foreground',
                )}
              >
                {name}
              </span>
            ) : (
              <button
                type="button"
                onClick={(event) => {
                  openNode(id, event.currentTarget);
                }}
                className="-mx-1 flex min-h-11 items-center px-1 text-left font-mono text-report-label text-foreground underline sm:whitespace-nowrap decoration-border underline-offset-4 outline-none hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
              >
                {name}
              </button>
            )}
            <span
              className={cn(
                'text-right text-report-lead leading-none tracking-[-0.04em] tabular-nums max-sm:absolute max-sm:top-[calc(100%-1.75rem)] max-sm:h-7 max-sm:content-center',
                // Under 640px the value stands beside the axis, on the side the bar leaves free.
                row.value < 0
                  ? 'max-sm:left-[calc(50%+0.75rem)] max-sm:text-left'
                  : 'max-sm:right-[calc(50%+0.75rem)]',
                lead ? accent.text : 'text-foreground',
              )}
            >
              {row.value > 0 ? '+' : ''}
              {row.value}
            </span>
            <div className="relative h-7">
              <span
                aria-hidden="true"
                className="absolute inset-y-[-4px] left-1/2 w-px bg-chart-axis"
              />
              <motion.span
                aria-hidden="true"
                // One fill for all bars: the side of the axis gives the sign. The crude total takes
                // the accent.
                className={cn('absolute inset-y-0', lead ? accent.bg : 'bg-foreground/60')}
                style={{
                  left: row.value < 0 ? `${String(50 - share)}%` : '50%',
                  width: `${String(share)}%`,
                  originX: row.value < 0 ? 1 : 0,
                }}
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={DRAW}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const MONTHS = figureData.fleet[0]?.points.map((point) => point.month) ?? [];

function FleetLines() {
  const box = useRef<HTMLDivElement>(null);
  const { width } = useSize(box);
  const { labels, number, copy, fleetLabels } = useFigure();
  // Figure 1 of the text names the three ports that the EU bans from February 2025.
  const MARKS = [
    { month: '2022-12', label: labels['embargo (UE)'] ?? '', short: labels['embargo (UE)'] ?? '' },
    {
      month: '2025-02',
      label: `${copy.bannedPorts} ${labels['ports interdits'] ?? ''}`,
      short: `3 ${labels['ports interdits'] ?? ''}`,
    },
  ];
  const height = 240;
  const narrow = width < 640;
  // On a phone each mark label takes its own row, so no two labels touch.
  const pad = { left: 50, right: narrow ? 16 : 175, top: narrow ? 38 : 24, bottom: 28 };
  const x = (month: string) =>
    pad.left +
    (MONTHS.indexOf(month) / Math.max(1, MONTHS.length - 1)) *
      Math.max(1, width - pad.left - pad.right);
  const y = (value: number) => pad.top + ((3200 - value) / 3200) * (height - pad.top - pad.bottom);
  return (
    <div ref={box}>
      {width === 0 ? (
        <div style={{ height }} />
      ) : (
        <svg width={width} height={height} role="img" aria-label={copy.cTitle} className="block">
          {[0, 1000, 2000, 3000].map((tick) => (
            <g key={tick}>
              <line
                x1={pad.left}
                x2={width - pad.right}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? 'stroke-chart-axis' : 'stroke-chart-grid'}
              />
              <text
                x={pad.left - 6}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-label font-mono text-report-label tabular-nums"
              >
                {number.format(tick)}
              </text>
            </g>
          ))}
          {['2023-01', '2024-01', '2025-01', '2026-01'].map((month) => (
            <text
              key={month}
              x={x(month)}
              y={height - 8}
              textAnchor="middle"
              className="fill-label font-mono text-report-label"
            >
              {month.slice(0, 4)}
            </text>
          ))}
          {MARKS.map((mark, index) => (
            <g key={mark.month}>
              <line
                x1={x(mark.month)}
                x2={x(mark.month)}
                y1={pad.top - 8}
                y2={height - pad.bottom}
                className="stroke-foreground"
              />
              <text
                x={x(mark.month) + (narrow && index > 0 ? -4 : 4)}
                y={pad.top - 12 - (narrow && index === 0 ? 13 : 0)}
                textAnchor={narrow && index > 0 ? 'end' : 'start'}
                className="fill-foreground font-mono text-report-label uppercase"
              >
                {narrow ? mark.short : mark.label}
              </text>
            </g>
          ))}
          {figureData.fleet.map((one) => {
            const lead = one.key === 'shadow';
            const last = one.points.at(-1);
            return (
              <g key={one.key}>
                <motion.path
                  d={one.points
                    .map(
                      (point, index) =>
                        `${index === 0 ? 'M' : 'L'}${x(point.month)},${y(point.value)}`,
                    )
                    .join('')}
                  fill="none"
                  strokeWidth={lead ? 2.5 : 1.5}
                  className={lead ? accent.stroke : 'stroke-chart-neutral'}
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={DRAW}
                />
                {last === undefined || narrow ? null : (
                  <text
                    x={x(last.month) + 8}
                    y={y(last.value) + 4}
                    className={cn(
                      'font-mono text-report-label',
                      lead ? accent.fill : 'fill-foreground',
                    )}
                  >
                    {fleetLabels[one.key]} {number.format(last.value)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-report-label text-muted-foreground sm:hidden">
        {figureData.fleet.map((one) => (
          <span key={one.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn('h-0.5 w-4', one.key === 'shadow' ? accent.bg : 'bg-chart-neutral')}
            />
            {fleetLabels[one.key]} · {number.format(one.points.at(-1)?.value ?? 0)} (
            {one.points.at(-1)?.month})
          </span>
        ))}
      </p>
    </div>
  );
}
