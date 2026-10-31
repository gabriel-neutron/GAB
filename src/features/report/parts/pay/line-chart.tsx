import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import type { Point } from './pay-data';

type Tone = 'accent' | 'ink' | 'tint' | 'muted' | 'faint';

export interface LineSeries {
  readonly id: string;
  readonly label: string;
  readonly tone: Tone;
  readonly points: readonly Point[];
  readonly dashed?: boolean;
  /** False hides the series with a fade; the scene of figure 4 shows it step by step. */
  readonly shown?: boolean;
}

export interface Scales {
  readonly x: (value: number) => number;
  readonly y: (value: number) => number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

export interface ChartSpec {
  /** The name of the chart for a screen reader. */
  readonly label: string;
  readonly unit: string;
  readonly x: readonly [number, number];
  readonly y: readonly [number, number];
  readonly xTicks: readonly { readonly at: number; readonly label: string }[];
  readonly yTicks: readonly number[];
  readonly series: readonly LineSeries[];
  /** The name of an x value in the table for a screen reader. */
  readonly xName: (x: number) => string;
  readonly digits?: number;
}

interface Layers {
  readonly under?: ReactNode;
  readonly over?: ReactNode;
  /** HTML over the chart, for controls such as node buttons. */
  readonly html?: ReactNode;
}

const STROKE: Record<Tone, string> = {
  accent: 'stroke-signal',
  ink: 'stroke-foreground',
  tint: 'stroke-foreground',
  muted: 'stroke-chart-neutral',
  faint: 'stroke-muted-foreground',
};
const TEXT: Record<Tone, string> = {
  accent: 'fill-signal',
  ink: 'fill-foreground',
  tint: 'fill-foreground',
  muted: 'fill-muted-foreground',
  faint: 'fill-muted-foreground',
};
// A tint or faint line steps back behind the series that the text names; its end label keeps
// the full ink of its tone, so that it stays legible in the two themes.
const shownClass = (tone: Tone, shown: boolean) =>
  !shown
    ? 'opacity-0'
    : // 70% keeps the muted line above 3:1 against the background in the two themes.
      tone === 'tint' || tone === 'faint'
      ? 'opacity-70'
      : 'opacity-100';
const MARGIN = { left: 34, top: 26, bottom: 30 };
// The width of one glyph of the 13px mono labels (0.6em and the tracking), and the gap before an
// end label.
export const GLYPH = 8.1;
const GAP = 12;
// The distance between the baselines of two stacked end labels.
const LINE = 18;
export const FADE = 'transition-opacity duration-500 motion-reduce:transition-none';

/** A line chart on a faint grid, in the one accent and neutrals. A missing value breaks the line.
 * A hollow mark is an estimate or a plan, and its line is dashed. Each line ends in its label. */
export function LineChart({
  spec,
  layers,
  fill = false,
}: {
  readonly spec: ChartSpec;
  readonly layers?: (scales: Scales) => Layers;
  /** True: the chart takes the height of its parent, not a height from its width. */
  readonly fill?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // An adapter: the browser reports the size of the box.
  useEffect(() => {
    const node = box.current;
    if (node === null) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined)
        setSize({
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height),
        });
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);
  const { width } = size;
  const height = fill
    ? Math.max(200, size.height)
    : Math.round(Math.min(440, Math.max(280, width * 0.6)));
  const digits = spec.digits ?? 0;
  // Room at the right for the longest end label.
  const longest = Math.max(
    ...spec.series.map((one) => {
      const last = one.points.findLast((point) => point !== null);
      return last === undefined ? 0 : `${one.label} ${last.y.toFixed(digits)}`.length;
    }),
  );
  const right = width - longest * GLYPH - GAP;
  const bottom = height - MARGIN.bottom;
  const [x0, x1] = spec.x;
  const [y0, y1] = spec.y;
  const scales: Scales = {
    x: (value) => MARGIN.left + ((value - x0) / (x1 - x0)) * (right - MARGIN.left),
    y: (value) => bottom - ((value - y0) / (y1 - y0)) * (bottom - MARGIN.top),
    left: MARGIN.left,
    right,
    top: MARGIN.top,
    bottom,
  };
  const extra = width === 0 || layers === undefined ? {} : layers(scales);

  // End labels in value order, pushed apart so that two labels never touch.
  const ends: { id: string; y: number; x: number; text: string; tone: Tone; shown: boolean }[] = [];
  spec.series
    .map((one) => ({ one, last: one.points.findLast((point) => point !== null) }))
    .flatMap(({ one, last }) => (last === undefined ? [] : [{ one, last }]))
    .sort((a, b) => b.last.y - a.last.y)
    .forEach(({ one, last }) => {
      const above = ends.at(-1)?.y ?? -Infinity;
      ends.push({
        id: one.id,
        y: Math.max(scales.y(last.y) + 4, above + LINE),
        x: scales.x(last.x) + 8,
        text: `${one.label} ${last.y.toFixed(digits)}`,
        tone: one.tone,
        shown: one.shown ?? true,
      });
    });
  // The stack stays above the year labels: the lowest labels move up when the stack is too deep.
  for (let at = ends.length - 1, floor = bottom - 2; at >= 0; at -= 1) {
    const end = ends[at];
    if (end === undefined) continue;
    end.y = Math.min(end.y, floor);
    floor = end.y - LINE;
  }

  return (
    <div
      ref={box}
      className={cn('relative w-full min-w-0', fill && 'h-full')}
      style={fill ? undefined : { height }}
    >
      {width === 0 ? null : (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${String(width)} ${String(height)}`}
          aria-hidden="true"
          className="block overflow-visible font-mono text-report-label"
        >
          <text x={0} y={12} className="fill-label">
            {spec.unit}
          </text>
          {spec.yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={right}
                y1={scales.y(tick)}
                y2={scales.y(tick)}
                className="stroke-chart-grid"
              />
              <text
                x={MARGIN.left - 6}
                y={scales.y(tick) + 4}
                textAnchor="end"
                className="fill-label tabular-nums"
              >
                {tick}
              </text>
            </g>
          ))}
          {spec.xTicks.map((tick) => (
            <text
              key={tick.at}
              x={scales.x(tick.at)}
              y={bottom + 20}
              textAnchor="middle"
              className="fill-label tabular-nums"
            >
              {tick.label}
            </text>
          ))}
          {extra.under}
          {spec.series.map((one) => (
            <g key={one.id} className={cn(FADE, shownClass(one.tone, one.shown ?? true))}>
              <path
                d={linePath(one.points, scales)}
                fill="none"
                strokeWidth={one.tone === 'ink' || one.tone === 'accent' ? 2 : 1.5}
                strokeDasharray={one.dashed === true ? '5 4' : undefined}
                className={STROKE[one.tone]}
              />
              {one.points.map((point) =>
                point === null ? null : (
                  <circle
                    key={point.x}
                    cx={scales.x(point.x)}
                    cy={scales.y(point.y)}
                    r={point.hollow ? 3.5 : 2.5}
                    strokeWidth={1.5}
                    className={cn(
                      STROKE[one.tone],
                      point.hollow ? 'fill-background' : TEXT[one.tone],
                    )}
                  />
                ),
              )}
            </g>
          ))}
          {ends.map((end) => (
            <text
              key={end.id}
              x={end.x}
              y={end.y}
              className={cn(FADE, TEXT[end.tone], end.shown ? 'opacity-100' : 'opacity-0')}
            >
              {end.text}
            </text>
          ))}
          {extra.over}
        </svg>
      )}
      {extra.html}
      <DataTable spec={spec} />
    </div>
  );
}

/** The path of a line that breaks at each missing value. */
function linePath(points: readonly Point[], scales: Scales): string {
  let path = '';
  let open = false;
  for (const point of points) {
    if (point === null) {
      open = false;
      continue;
    }
    path += `${open ? 'L' : 'M'}${scales.x(point.x).toFixed(1)},${scales.y(point.y).toFixed(1)}`;
    open = true;
  }
  return path;
}

/** The values of the chart as a table, for a screen reader. */
function DataTable({ spec }: { readonly spec: ChartSpec }) {
  const xs = [
    ...new Set(spec.series.flatMap((one) => one.points.flatMap((p) => (p ? [p.x] : [])))),
  ].sort((a, b) => a - b);
  return (
    <table className="sr-only">
      <caption>
        {spec.label} ({spec.unit})
      </caption>
      <thead>
        <tr>
          <th scope="col" />
          {spec.series.map((one) => (
            <th key={one.id} scope="col">
              {one.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {xs.map((x) => (
          <tr key={x}>
            <th scope="row">{spec.xName(x)}</th>
            {spec.series.map((one) => (
              <td key={one.id}>
                {one.points.find((p) => p?.x === x)?.y.toFixed(spec.digits ?? 0) ?? ''}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
