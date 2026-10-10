import { releaseDay } from './release-day.ts';
import { claimPage, hrefFrom, type SitePath } from './site-paths.ts';
import { timelineAxis } from './timeline-axis.ts';
import type { MarkTime, TimelineLane, TimelineMark } from './vessel-timeline.ts';

export interface TimelineFigureProps {
  readonly lanes: readonly TimelineLane[];
  readonly versionDate: string;
  readonly here: SitePath;
}

// The units of the drawing. The figure scales to the width of the page.
const WIDTH = 960;
const PLOT_LEFT = 190;
const PLOT_RIGHT = 930;
const AXIS = 28;
const ROW = 32;
const BAR = 8;
const ARROW = 8;
const FOOT = 22;

// External constraint: an SVG text does not wrap, so a long name is cut to fit beside the bar.
const MOST_CHARACTERS = 70;

const cut = (text: string): string =>
  text.length > MOST_CHARACTERS ? `${text.slice(0, MOST_CHARACTERS - 1)}…` : text;

const timeWords = (time: MarkTime): string => {
  if (time.kind === 'day') return `${time.key}: ${releaseDay(time.day)}`;
  if (time.kind === 'no date') return 'no date';
  const from = time.from === null ? 'start unknown' : releaseDay(time.from);
  const to = time.to === null ? 'open' : releaseDay(time.to);
  return `${from} to ${to}`;
};

/** The timeline of the dated marks of a vessel, drawn at build time. Each mark links to its
 * claim. The figure is hidden from a screen reader and a keyboard, because the list beside it
 * gives each mark. */
export function TimelineFigure({ lanes, versionDate, here }: TimelineFigureProps) {
  const axis = timelineAxis(lanes, versionDate);
  if (axis === null) return null;
  const x = (day: string) => PLOT_LEFT + axis.at(day) * (PLOT_RIGHT - PLOT_LEFT);
  const rows = lanes.flatMap((lane) =>
    lane.marks
      .filter((mark) => mark.time.kind !== 'no date')
      .map((mark, index) => ({ lane, mark, first: index === 0 })),
  );
  const bottom = AXIS + rows.length * ROW + 4;
  const height = bottom + FOOT;
  const version = x(versionDate);
  // An open bar goes to the line of the version, or stays at its start when it starts later.
  const openEnd = (from: string | null) => (from === null ? version : Math.max(version, x(from)));
  const href = (mark: TimelineMark) => hrefFrom(here, claimPage(mark.claim.id));

  return (
    <svg
      viewBox={`0 0 ${String(WIDTH)} ${String(height)}`}
      className="hidden w-full text-xs md:block"
      aria-hidden="true"
      data-timeline=""
    >
      {axis.years.map((year) => (
        <g key={year}>
          <line
            x1={x(year)}
            x2={x(year)}
            y1={AXIS - 6}
            y2={bottom}
            className="stroke-border"
            strokeWidth={1}
          />
          <text x={x(year) + 3} y={AXIS - 10} className="fill-muted-foreground">
            {year.slice(0, 4)}
          </text>
        </g>
      ))}
      <line
        x1={version}
        x2={version}
        y1={AXIS - 6}
        y2={bottom}
        className="stroke-foreground"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <text x={version} y={height - 6} textAnchor="end" className="fill-foreground">
        Version {releaseDay(versionDate)}
      </text>
      {rows.map(({ lane, mark, first }, index) => {
        const top = AXIS + index * ROW;
        const bar = top + 18;
        const { time } = mark;
        return (
          <g key={mark.key}>
            {first ? (
              <>
                <line
                  x1={0}
                  x2={WIDTH}
                  y1={top}
                  y2={top}
                  className="stroke-border"
                  strokeWidth={1}
                />
                <text x={0} y={top + 14} className="fill-foreground font-medium">
                  {lane.words}
                </text>
              </>
            ) : null}
            <text x={PLOT_LEFT} y={top + 13} className="fill-foreground">
              {cut(`${mark.words} · ${timeWords(time)}`)}
            </text>
            <a href={href(mark)} tabIndex={-1}>
              {time.kind === 'day' ? (
                <circle cx={x(time.day)} cy={bar + BAR / 2} r={5} className="fill-foreground" />
              ) : time.kind === 'interval' ? (
                <IntervalBar
                  start={time.from === null ? PLOT_LEFT : x(time.from)}
                  end={time.to === null ? openEnd(time.from) : x(time.to)}
                  top={bar}
                  knownStart={time.from !== null}
                  open={time.to === null}
                />
              ) : null}
            </a>
            {time.kind === 'interval' && time.to !== null && time.endClaim !== null ? (
              <a href={hrefFrom(here, claimPage(time.endClaim.id))} tabIndex={-1}>
                <rect
                  x={x(time.to) - 2}
                  y={bar - 4}
                  width={4}
                  height={BAR + 8}
                  className="fill-foreground"
                />
              </a>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function IntervalBar({
  start,
  end,
  top,
  knownStart,
  open,
}: {
  readonly start: number;
  readonly end: number;
  readonly top: number;
  readonly knownStart: boolean;
  readonly open: boolean;
}) {
  const width = Math.max(end - start, 2);
  const tip = start + width;
  return (
    <>
      {knownStart ? (
        <rect x={start} y={top} width={width} height={BAR} className="fill-muted-foreground" />
      ) : (
        <rect
          x={start}
          y={top}
          width={width}
          height={BAR}
          className="fill-none stroke-muted-foreground"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
      )}
      {open ? (
        <polygon
          points={`${String(tip)},${String(top - 3)} ${String(tip + ARROW)},${String(top + BAR / 2)} ${String(tip)},${String(top + BAR + 3)}`}
          className="fill-foreground"
        />
      ) : null}
    </>
  );
}
