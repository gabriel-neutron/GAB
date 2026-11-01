import { useId, useRef, type ReactNode, type Ref } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { figureTexts, portsFleetUi } from '../../content';
import { accent } from '../../primitives/accent';
import { layout } from '../../primitives/layout';
import { useReport } from '../../use-report';
import { chartLayout } from './chart-layout';
import { figureData } from './figure-data';
import { mapGeometry, type Box, type Frame } from './map-geometry';
import { TERMINALS } from './terminals';
import { useSize } from './use-size';

const copy = portsFleetUi.map;
const EASE = [0.4, 0, 0.2, 1] as const;
const number = new Intl.NumberFormat('en-US');

/** The direction of the leader line from a terminal to its label: x and y, each -1 or 1. */
const LEADS: Readonly<Record<string, readonly [number, number]>> = {
  'N-P001': [1, -1],
  'N-P002': [1, 1],
  'N-P005': [-1, 1],
  'N-P011': [1, 1],
  'N-P009': [-1, -1],
  'N-P007': [-1, 1],
};

// The names of figure 6b for the terminals of the map.
const CHANGE_NAMES: Readonly<Record<string, string>> = {
  'N-P001': 'Primorsk',
  'N-P002': 'Ust-Luga',
  'N-P005': 'Novorossiysk (incl. CPC)',
  'N-P011': 'Tuapse',
};
const change = new Map(figureData.change.map((row) => [row.name, row.value]));
// The short line under the position of a named terminal, for each kind of step.
const notes: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ban: copy.banDates,
  // The final text gives no words for the terminals of the Pacific step.
  pacific: {},
};

interface MapStep {
  readonly box: Box;
  /** The terminals the card names, in the order of the text. */
  readonly named: readonly string[];
  readonly tag?: 'ban' | 'pacific' | 'change';
  readonly flows?: true;
}

/** One state of the map for each card of the scene. The camera holds the terminals it names. */
export const MAP_STEPS: readonly MapStep[] = [
  {
    box: [26.5, 42.5, 41.5, 70.5],
    named: ['N-P001', 'N-P002', 'N-P005', 'N-P011', 'N-P009'],
    tag: 'ban',
  },
  // The text names the ports of the Baltic, the Black Sea and the Pacific, so the camera holds both
  // ends of the country.
  { box: [24, 38, 140, 66], named: ['N-P001', 'N-P002', 'N-P005', 'N-P007'], tag: 'pacific' },
  { box: [25.5, 42.6, 42, 61.4], named: ['N-P001', 'N-P002', 'N-P005', 'N-P011'], tag: 'change' },
  { box: [22, 38, 140, 74], named: [], flows: true },
];

// Seaborne crude by loading basin and fleet category, from figure 7a. Each basin has its own
// column above its sea. The terminals only place the column: no source gives the volume of one
// terminal, so no line joins a column to a terminal.
const BASINS = [
  { name: 'Baltic', ports: ['N-P001', 'N-P002'] },
  { name: 'Arctic', ports: ['N-P009', 'N-P016'] },
  { name: 'Black Sea', ports: ['N-P005', 'N-P011'] },
  { name: 'Pacific', ports: ['N-P007'] },
] as const;
const SHADOW = '“Shadow fleet”';
const crude = (basin: string) =>
  figureData.flows.filter((row) => row.panel === 'a' && row.from === `Crude · ${basin}`);
const total = (basin: string) => crude(basin).reduce((sum, row) => sum + (row.value ?? 0), 0);
const MAX_FLOW = Math.max(...BASINS.map((basin) => total(basin.name)));
const terminalOf = new Map(TERMINALS.map((terminal) => [terminal.id, terminal]));
const fleetFill = (to: string) =>
  to === SHADOW
    ? accent.fill
    : to === 'IG-insured'
      ? 'fill-chart-neutral'
      : 'fill-map-water stroke-foreground';
const fleetTags: Readonly<Record<string, string>> = copy.fleetTags;
// The dates of the ban step come from the text of the part. The Pacific step has no note.
const TEXT_SOURCES = {
  ban: 'Dates: text of the report, note 42 (February 2025 to April 2026)',
  pacific: '',
} as const;
const SCHEMATIC =
  'Schematic: each column stands above its sea and gives the basin total, not the volume of a terminal.';
const labels7: Readonly<Record<string, string>> = figureTexts.figures['7'].labels;

/** The sources of the data that a step shows: figure 6 for the changes, figure 7 for the flows. */
export interface MapSources {
  readonly change: string;
  readonly flows: string;
}

interface PortMapProps {
  readonly step: number;
  readonly sources: MapSources;
}

/** The dark map of the export terminals. The camera, the named terminals and the flows follow the
 * card in view. Every terminal opens its record. */
export function PortMap({ step, sources }: PortMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const foot = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(box);
  const headHeight = useSize(head).height;
  const footSize = useSize(foot);
  const reduce = useReducedMotion() === true;
  const visible = useInView(box, { amount: 0.2 });
  const { openNode } = useReport();
  const id = useId();
  const state = MAP_STEPS[step] ?? MAP_STEPS[0];
  if (state === undefined) return null;
  const sticky = !reduce;
  const flows = state.flows === true;
  // Under 1024px the card is a sheet on the lower part of the view, so the map uses the upper part.
  // From 1024px the map moves right of the cards.
  const wide = width >= 1024;
  const compact = width < 640;
  const side = Math.max(0, (width - 1200) / 2) + 32 + 384 + 32;
  const big = wide ? 28 : 20;
  // The flow columns stand in a band under the head, the map under the band. A column is a bar
  // with its name, its shadow-fleet value and its other value above it.
  const bar = compact ? 20 : wide ? 44 : 32;
  // The sizes of the report roles: the label, and the lead at this width.
  const flowBig = wide ? 28 : 20;
  const line = 13;
  const slot = compact ? 84 : wide ? 160 : 120;
  // The name, the shadow-fleet value, its tag and the other value.
  const textHeight = line * 3 + flowBig + 20;
  const band = textHeight + (wide && sticky ? Math.min(200, height * 0.24) : compact ? 56 : 100);
  const bandTop = headHeight + 24;
  const baseline = bandTop + band;
  // Room for the labels that stand above a terminal, or for the band of the flow columns. Under
  // 1024px the head holds the legend and the sources, so the room takes the full label block of
  // the step: no label can go into the head.
  const rise = 22 + 16 + 16 + (state.tag === 'change' ? big + 3 : state.tag === undefined ? 0 : 16);
  const top = flows ? baseline + 28 : headHeight + (wide ? 24 : rise + 16);
  // Under 1024px the card stands from 55% of the view on a phone and from 62% from 768px or for
  // the flows (map-scene.css). The map starts under the part bar.
  // shortcut: the part bar is 2rem at a 16px root; read --report-bar if it changes.
  const view = typeof window === 'undefined' ? height : window.innerHeight;
  const tablet = typeof window !== 'undefined' && window.innerWidth >= 768;
  const cardTop = view * (flows || tablet ? 0.62 : 0.55) - 32;
  const frame: Frame = !sticky
    ? { width, height, left: 24, right: 24, top, bottom: flows ? 24 : 84 }
    : wide
      ? {
          width,
          height,
          // The map of the flows moves left, so Europe fills the room above the card column.
          left: flows ? side - 120 : side + 48,
          right: flows ? 296 : 96,
          top: top + (flows ? 0 : 24),
          // A label under a terminal stays above the fade of the foot.
          bottom: flows ? 180 : 180 + rise,
        }
      : {
          width,
          height,
          left: 24,
          right: 24,
          top,
          // The card covers the lower part of the view; a label under a terminal stays above it.
          bottom: height - cardTop + (flows ? 16 : rise + 12),
        };
  const camera = mapGeometry.fit(state.box, frame);
  const screen = (lon: number, lat: number) => {
    const [x, y] = mapGeometry.project(lon, lat);
    return { x: x * camera.scale + camera.x, y: y * camera.scale + camera.y };
  };
  // The values stand in one row at the top of the band, 12px or more above the tallest column.
  const flowScale = (band - textHeight - 12) / MAX_FLOW;
  // Each column starts above the middle of its terminals and moves aside, so no two touch.
  const ports = BASINS.map((basin) =>
    basin.ports.flatMap((id) => {
      const terminal = terminalOf.get(id);
      return terminal === undefined ? [] : [screen(terminal.lon, terminal.lat)];
    }),
  );
  const slots = chartLayout.spread(
    ports.map((at) => Math.min(...at.map((one) => one.x)) - bar / 2),
    slot,
    frame.left,
    // A centred value on a phone needs only the room of its column on the right.
    width - (wide && sticky ? 96 : frame.right) - (compact ? bar : slot - 16),
  );
  // One line for each source, so no line breaks in the middle of a name.
  const credit = [
    state.tag === 'ban' || state.tag === 'pacific' ? TEXT_SOURCES[state.tag] : '',
    state.tag === 'change' ? `${copy.data} ${sources.change}` : '',
    flows ? `${copy.data} ${sources.flows}` : '',
    flows ? SCHEMATIC : '',
    `${copy.basemap} ${mapGeometry.source}`,
  ]
    .filter((one) => one !== '')
    .map((one) => (
      <p key={one} className="text-balance">
        {one}
      </p>
    ));
  const title = flows
    ? copy.flows
    : state.tag === 'ban'
      ? copy.ban
      : state.tag === 'change'
        ? copy.change
        : state.tag === 'pacific'
          ? copy.pacific
          : copy.named;
  const legend = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className={cn('size-2', accent.bg)} />
        {flows ? labels7['« Flotte fantôme »'] : copy.named}
      </span>
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn('size-2', flows ? 'bg-chart-neutral' : 'bg-label')}
        />
        {flows ? labels7['Assurés IG'] : copy.other}
      </span>
      {flows ? (
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="size-2 border border-foreground" />
          {labels7['Coalition, sans assurance IG']}
        </span>
      ) : null}
    </div>
  );
  // A square of another terminal never stands on a label of a named terminal, the head or the foot.
  const covers = state.named.flatMap((one) => {
    const terminal = terminalOf.get(one);
    if (terminal === undefined) return [];
    const at = screen(terminal.lon, terminal.lat);
    const { box: area } = markerLayout({ ...terminal, tag: state.tag, big });
    return [{ x0: at.x + area.x0, x1: at.x + area.x1, y0: at.y + area.y0, y1: at.y + area.y1 }];
  });
  if (sticky && !wide) covers.push({ x0: 0, x1: width, y0: 0, y1: headHeight });
  if (sticky && wide)
    covers.push({
      x0: width - footSize.width,
      x1: width,
      y0: height - footSize.height,
      y1: height,
    });
  const hidden = (at: { x: number; y: number }) =>
    at.x < 8 ||
    at.x > width - 8 ||
    covers.some(
      (area) =>
        at.x > area.x0 - 6 && at.x < area.x1 + 6 && at.y > area.y0 - 6 && at.y < area.y1 + 6,
    );
  const move = reduce ? { duration: 0 } : { duration: 0.9, ease: EASE };
  // The basemap data ends at a box: the land fades out at its edges, into the graticule.
  const [x0, y0] = mapGeometry.project(mapGeometry.bounds[0], mapGeometry.bounds[3]);
  const [x1, y1] = mapGeometry.project(mapGeometry.bounds[2], mapGeometry.bounds[1]);
  const edge = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  const pulse = visible && !reduce;
  const map = (
    <div
      ref={box}
      className={cn(
        'relative isolate overflow-hidden bg-map-water',
        sticky
          ? cn(
              layout.bleed,
              layout.view,
              // Under 1024px the lower part of the map is the room of the card: it fades into the
              // page, so the scene ends with no hard edge.
              !wide && '[mask-image:linear-gradient(to_bottom,#000_70%,transparent)]',
            )
          : cn(
              'aspect-[4/5] w-full border border-border',
              flows ? 'sm:aspect-[5/4]' : 'sm:aspect-[16/10]',
            ),
      )}
    >
      {width === 0 ? null : (
        <svg
          role="group"
          aria-label={copy.label}
          width={width}
          height={height}
          className="absolute inset-0 block"
        >
          <defs>
            {(['x', 'y'] as const).map((axis) => (
              <linearGradient
                key={axis}
                id={`${id}-${axis}`}
                x2={axis === 'x' ? 1 : 0}
                y2={axis === 'y' ? 1 : 0}
              >
                <stop offset={0} stopColor="#000" />
                <stop offset={0.08} stopColor="#fff" />
                <stop offset={0.92} stopColor="#fff" />
                <stop offset={1} stopColor="#000" />
              </linearGradient>
            ))}
            {(['x', 'y'] as const).map((axis) => (
              <mask key={axis} id={`${id}-m${axis}`} maskUnits="userSpaceOnUse" {...edge}>
                <rect {...edge} fill={`url(#${id}-${axis})`} />
              </mask>
            ))}
            <linearGradient id={`${id}-band`} x2={0} y2={1}>
              <stop offset={0} stopColor="var(--map-water)" stopOpacity={0.9} />
              <stop
                offset={baseline / (baseline + 48)}
                stopColor="var(--map-water)"
                stopOpacity={0.9}
              />
              <stop offset={1} stopColor="var(--map-water)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <motion.g
            initial={false}
            animate={{ x: camera.x, y: camera.y, scale: camera.scale }}
            transition={move}
            style={{ transformBox: 'view-box', originX: 0, originY: 0 }}
          >
            <path
              d={mapGeometry.graticule}
              fill="none"
              className="stroke-chart-grid"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <g mask={`url(#${id}-mx)`}>
              <path
                mask={`url(#${id}-my)`}
                d={mapGeometry.land}
                className="fill-map-land stroke-map-boundary"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          </motion.g>

          <motion.g
            initial={false}
            animate={{ opacity: flows ? 1 : 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, delay: flows ? 0.6 : 0 }}
            aria-hidden={!flows}
          >
            {/* The band of the columns stands on the sea colour, clear of the land behind it, and
                fades into the map under the baseline. */}
            <rect width={width} height={baseline + 48} fill={`url(#${id}-band)`} />
            {BASINS.map((basin, index) => {
              const x = slots[index] ?? 0;
              const rows = crude(basin.name);
              const shadow = rows.find((row) => row.to === SHADOW);
              const others = rows.filter((row) => row.to !== SHADOW);
              let stack = 0;
              const blocks = rows.map((row) => {
                stack += (row.value ?? 0) * flowScale;
                return { row, tall: (row.value ?? 0) * flowScale, top: stack };
              });
              const head = baseline - band;
              // On a phone each value stands centred over its column, so no two values touch.
              const tx = compact ? x + bar / 2 : x;
              return (
                <g key={basin.name}>
                  <motion.g
                    initial={false}
                    animate={{ scaleY: flows ? 1 : 0 }}
                    transition={
                      reduce ? { duration: 0 } : { duration: 0.8, delay: 0.7, ease: EASE }
                    }
                    style={{ originY: 1 }}
                  >
                    {blocks.map(({ row, tall, top: stop }) => (
                      <rect
                        key={row.to}
                        x={x}
                        y={baseline - stop}
                        width={bar}
                        height={Math.max(1, tall)}
                        strokeWidth={1}
                        className={fleetFill(row.to)}
                      />
                    ))}
                  </motion.g>
                  <line
                    x1={x - 4}
                    x2={x + bar + 4}
                    y1={baseline}
                    y2={baseline}
                    strokeWidth={1}
                    className="stroke-foreground"
                  />
                  <text
                    x={tx}
                    y={head + line}
                    textAnchor={compact ? 'middle' : 'start'}
                    className="stroke-map-water font-mono uppercase"
                    strokeWidth={4}
                    strokeLinejoin="round"
                    style={{ fontSize: line, paintOrder: 'stroke' }}
                  >
                    <tspan className="fill-foreground">{basin.name}</tspan>
                    <tspan
                      x={tx}
                      dy={flowBig + 2}
                      className={cn('font-sans tabular-nums tracking-[-0.03em]', accent.fill)}
                      style={{ fontSize: flowBig }}
                    >
                      {number.format(shadow?.value ?? 0)}
                    </tspan>
                    {/* The large value is the shadow fleet only, not the total of the column. On a
                        phone the tag is wider than its column: the accent and the legend name it. */}
                    {compact ? null : (
                      <tspan x={tx} dy={line + 4} className={cn('normal-case', accent.fill)}>
                        {fleetTags[SHADOW] ?? SHADOW}
                      </tspan>
                    )}
                    {others.map((row) => (
                      <tspan
                        key={row.to}
                        x={tx}
                        dy={line + 4}
                        className="fill-label tabular-nums normal-case"
                      >
                        {`${number.format(row.value ?? 0)} ${fleetTags[row.to] ?? row.to}`}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </motion.g>

          {TERMINALS.map((terminal) => {
            const at = screen(terminal.lon, terminal.lat);
            const order = state.named.indexOf(terminal.id);
            if (order < 0 && hidden(at)) return null;
            return (
              <motion.g
                key={terminal.id}
                initial={false}
                animate={{ x: at.x, y: at.y }}
                transition={move}
              >
                {order < 0 ? (
                  <rect x={-2.5} y={-2.5} width={5} height={5} className="fill-label" />
                ) : (
                  <Marker
                    id={terminal.id}
                    label={terminal.label}
                    lat={terminal.lat}
                    lon={terminal.lon}
                    tag={state.tag}
                    big={big}
                    pulse={pulse ? { order, count: state.named.length } : undefined}
                  />
                )}
              </motion.g>
            );
          })}
        </svg>
      )}

      {width === 0
        ? null
        : TERMINALS.map((terminal) => {
            const at = screen(terminal.lon, terminal.lat);
            // A terminal that the map does not draw gets no button.
            if (!state.named.includes(terminal.id) && hidden(at)) return null;
            return (
              <motion.button
                key={terminal.id}
                type="button"
                aria-label={`${copy.open} ${terminal.label}`}
                initial={false}
                animate={{ x: at.x - 22, y: at.y - 22 }}
                transition={move}
                onClick={(event) => {
                  openNode(terminal.id, event.currentTarget);
                }}
                className="absolute top-0 left-0 size-11 cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-[-12px] focus-visible:outline-solid focus-visible:outline-ring"
              />
            );
          })}
      <div
        ref={head}
        className={cn(
          // A halo of the sea colour keeps the words of the head clear of the coasts.
          'pointer-events-none absolute inset-x-0 top-0 grid gap-1.5 p-4 font-mono [text-shadow:0_0_2px_var(--map-water),0_0_2px_var(--map-water),0_0_4px_var(--map-water)] text-report-label/4 uppercase text-label md:gap-2 md:px-8',
          sticky && wide ? 'justify-items-end text-right' : '',
        )}
      >
        <p className="max-w-[48ch] text-balance text-foreground">{title}</p>
        {sticky && !wide ? (
          <div className="grid gap-1 text-report-label/4 normal-case ">
            {legend}
            {credit}
          </div>
        ) : null}
      </div>
      {sticky && wide ? (
        <>
          {/* The map fades to the sea colour across its foot, so no coast runs through the words. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-linear-to-t from-map-water from-35% to-transparent"
          />
          <MapFoot
            ref={foot}
            className="absolute right-0 bottom-0 max-w-[84ch] justify-items-end pt-4 pr-8 pb-4 pl-24 text-right"
          >
            {legend}
            {credit}
          </MapFoot>
        </>
      ) : null}
    </div>
  );
  if (sticky) return map;
  return (
    <div>
      {map}
      <MapFoot className="mt-3">
        {legend}
        {credit}
      </MapFoot>
    </div>
  );
}

function MapFoot({
  ref,
  className,
  children,
}: {
  readonly ref?: Ref<HTMLDivElement>;
  readonly className: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        'pointer-events-none grid gap-1 font-mono text-report-label/4 text-label',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface MarkerProps {
  readonly id: string;
  readonly label: string;
  readonly lat: number;
  readonly lon: number;
  readonly tag: MapStep['tag'];
  readonly big: number;
  readonly pulse: { readonly order: number; readonly count: number } | undefined;
}

/** The leader and the lines of the label of a named terminal, from the terminal. */
function markerLayout({ id, label, lat, lon, tag, big }: Omit<MarkerProps, 'pulse'>) {
  const [sx, sy] = LEADS[id] ?? [1, -1];
  const lead = 22;
  const ax = sx * lead;
  const ay = sy * lead;
  const tx = ax + sx * 4;
  const value = tag === 'change' ? change.get(CHANGE_NAMES[id] ?? '') : undefined;
  const date = tag === undefined || tag === 'change' ? '' : (notes[tag]?.[id] ?? '');
  const valueText = value === undefined ? '' : `${value > 0 ? '+' : ''}${String(value)}%`;
  const valueSize = valueText === '' ? (date === '' ? 0 : 13) : big;
  // The lines stack away from the terminal: upward above it, downward under it.
  const lines = [
    { text: label, size: 13, className: 'fill-foreground font-mono uppercase' },
    {
      text: `${lat.toFixed(2)} N · ${lon.toFixed(2)} E`,
      size: 13,
      className: 'fill-foreground/75 font-mono tabular-nums',
    },
    ...(valueSize === 0
      ? []
      : [
          {
            text: valueText === '' ? date : valueText,
            size: valueSize,
            className: cn(
              'tabular-nums',
              valueText === '' ? 'font-mono uppercase' : 'font-sans tracking-[-0.04em]',
              // The accent marks the named terminals only: a value or a date takes the ink.
              'fill-foreground',
            ),
          },
        ]),
  ];
  const heights = lines.map((line) => line.size + 3);
  const block = heights.reduce((sum, one) => sum + one, 0);
  const top = sy < 0 ? ay - block : ay;
  // shortcut: the width of a line is its length at 0.62 em a glyph, measure the text if a label
  // overlaps a marker.
  const wide = Math.max(...lines.map((line) => line.text.length * line.size * 0.62));
  const left = sx < 0 ? tx - wide : tx;
  return {
    sx,
    sy,
    ax,
    ay,
    tx,
    // The baseline of each line: the lines stack away from the terminal.
    lines: lines.map((line, index) => ({
      ...line,
      y: top + heights.slice(0, index + 1).reduce((sum, one) => sum + one, 0) - 3,
    })),
    top,
    // The ring, the leader and the label, around the terminal.
    box: {
      x0: Math.min(-14, left),
      x1: Math.max(14, left + wide),
      y0: Math.min(-14, top),
      y1: Math.max(14, top + block),
    },
  };
}

/** A named terminal: a ring with a cross, a leader line, the name, the position, and the value of
 * the step in large type. */
function Marker({ pulse, ...props }: MarkerProps) {
  const { sx, sy, ax, ay, tx, lines } = markerLayout(props);
  const anchor = sx < 0 ? 'end' : 'start';
  return (
    <g>
      {pulse === undefined ? null : (
        <motion.circle
          r={7}
          fill="none"
          strokeWidth={1}
          className={accent.stroke}
          initial={{ scale: 1, opacity: 0 }}
          animate={{ scale: [1, 3.5], opacity: [0.9, 0] }}
          transition={{
            duration: 1.6,
            delay: 0.6 + pulse.order * 0.45,
            repeat: Infinity,
            repeatDelay: Math.max(1, pulse.count * 0.45),
            ease: 'easeOut',
          }}
        />
      )}
      <circle r={7} fill="none" strokeWidth={1.5} className={accent.stroke} />
      <circle r={2} className={accent.fill} />
      <path d="M-13,0H-9M9,0H13M0,-13V-9M0,9V13" strokeWidth={1.5} className={accent.stroke} />
      <line
        x1={sx * 10}
        y1={sy * 10}
        x2={ax}
        y2={ay}
        strokeWidth={1}
        className="stroke-foreground"
      />
      <line
        x1={ax}
        y1={ay}
        x2={ax + sx * 14}
        y2={ay}
        strokeWidth={1}
        className="stroke-foreground"
      />
      {lines.map((line) => {
        return (
          <text
            key={line.text}
            x={tx}
            y={line.y}
            textAnchor={anchor}
            // A halo of the sea colour keeps the words clear of the coasts and the borders.
            className={cn(line.className, 'stroke-map-water')}
            strokeWidth={4}
            strokeLinejoin="round"
            style={{ fontSize: line.size, paintOrder: 'stroke' }}
          >
            {line.text}
          </text>
        );
      })}
    </g>
  );
}
