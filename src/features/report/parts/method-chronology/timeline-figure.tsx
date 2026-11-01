import { useRef, useState } from 'react';
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { cn } from '@/shared/lib/utils';
import type { ReportBlock } from '../../content';
import { accent } from '../../primitives/accent';
import { layout } from '../../primitives/layout';
import { Reveal } from '../../primitives/reveal';
import { useContent, type ReportContent } from '../../use-content';
import {
  AXIS_YEARS,
  cursorAt,
  END,
  GAP,
  GAP_PX,
  shiftFor,
  START,
  stepAt,
  TRACK,
  xOf,
  xOfYear,
  YEARS,
  yearAt,
} from './timeline-axis';
import { countsAt, REGIMES } from './timeline-counts';

type TimelineEvent = ReportContent['figureTexts']['fig2']['events'][number];
type Actors = ReportContent['methodUi']['timeline']['actors'];

const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';
const actorName = (actors: Actors, actor: string): string => actors[actor] ?? actor;
/** The years the text names as the period of the report, read from the quoted sentence. */
const periodOf = (period: string): readonly [number, number] => {
  const [from = START, to = END - 1] = (period.match(/\d{4}/g) ?? []).map(Number);
  return [from, to];
};

// Four bands of labels, so that close dates do not overlap: far above, far below, near above,
// near below. The offset is from the axis, in px.
const BANDS = [
  { above: true, offset: 150 },
  { above: false, offset: 150 },
  { above: true, offset: 40 },
  { above: false, offset: 40 },
] as const;

/** Figure 1: the sanctions from 2014 to 2026, with a time cursor on the events and the tankers
 * designated by each regime at the cursor. On a wide screen, the page scroll moves a time axis
 * across the view, at true scale outside the fold of the empty years, and moves the cursor with
 * it. On a phone, under reduced motion, and when no scroll frame is found, it is a list by year. */
export function TimelineFigure() {
  const reduce = useReducedMotion();
  const { figureTexts, methodUi } = useContent();
  const [track, setTrack] = useState(true);
  const [index, setIndex] = useState(0);
  const { events, legend } = figureTexts.fig2;
  return (
    <>
      {reduce === true || !track ? (
        <>
          <YearList />
          <Cursor index={index} onSelect={setIndex} />
        </>
      ) : (
        <>
          <div className="lg:hidden">
            <YearList />
            <Cursor index={index} onSelect={setIndex} />
          </div>
          <ScrollTrack
            index={index}
            onStep={setIndex}
            onMissing={() => {
              setTrack(false);
            }}
          />
        </>
      )}
      <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 border-t border-divider pt-3">
        {Object.entries(legend).map(([key, name]) => (
          <div key={key} className="flex items-baseline gap-2">
            <dt
              className={cn(
                'font-mono text-report-label',
                key === 'WAR' ? accent.text : 'text-foreground',
              )}
            >
              {actorName(methodUi.timeline.actors, key)}
            </dt>
            <dd className="text-report-small text-muted-foreground">{name}</dd>
          </div>
        ))}
      </dl>
      <details className="mt-3 border-t border-border pt-1">
        <summary
          className={cn(
            'flex min-h-11 cursor-pointer items-center font-mono text-report-label text-label',
            FOCUS,
          )}
        >
          {methodUi.timeline.table}
        </summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-left font-mono text-report-label">
            <thead className="text-label">
              <tr>
                <th className="py-1 pr-4 font-normal">{methodUi.timeline.date}</th>
                <th className="py-1 pr-4 font-normal">{methodUi.timeline.event}</th>
                {REGIMES.map((regime) => (
                  <th key={regime} className="py-1 pr-4 text-right font-normal">
                    {regime}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((event) => {
                const counts = countsAt(event.date);
                return (
                  <tr key={event.date + event.title} className="border-t border-divider">
                    <th
                      scope="row"
                      className="py-1 pr-4 font-normal whitespace-nowrap tabular-nums"
                    >
                      {event.date}
                    </th>
                    <td className="py-1 pr-4">{event.title}</td>
                    {REGIMES.map((regime) => (
                      <td key={regime} className="py-1 pr-4 text-right tabular-nums">
                        {counts[regime]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

interface CursorProps {
  readonly index: number;
  readonly onSelect: (index: number) => void;
}

/** The time cursor: a slider over the events, the event at the cursor and the counters by regime. */
function Cursor({ index, onSelect }: CursorProps) {
  const { figureTexts, methodUi } = useContent();
  const { events } = figureTexts.fig2;
  const event = events[index] ?? events[0];
  if (event === undefined) return null;
  const counts = countsAt(event.date);
  return (
    <div className="mt-6 grid gap-x-8 border-t border-foreground bg-background pt-3 sm:grid-cols-2">
      <div className="min-w-0">
        <label className="block">
          <span className="font-mono text-report-label uppercase text-label">
            {methodUi.timeline.cursor}
          </span>
          <input
            type="range"
            min={0}
            max={events.length - 1}
            step={1}
            value={index}
            aria-valuetext={`${event.date}, ${event.title}`}
            onChange={(change) => {
              onSelect(Number(change.target.value));
            }}
            className={cn('mt-2 block h-11 w-full accent-foreground', FOCUS)}
          />
        </label>
        <p className="font-mono text-report-label tabular-nums">
          <time dateTime={event.date} className="text-label">
            {event.date}
          </time>{' '}
          {event.title}
        </p>
      </div>
      <div className="min-w-0">
        <dl
          aria-live="polite"
          aria-atomic="true"
          aria-label={methodUi.timeline.counters}
          className="mt-3 grid grid-cols-3 gap-4 sm:mt-0"
        >
          {REGIMES.map((regime) => (
            <div key={regime} className="min-w-0 border-t border-divider pt-1">
              <dt className="font-mono text-report-label text-label">{regime}</dt>
              <dd className="font-mono text-report-heading leading-none tabular-nums">
                {counts[regime]}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-report-small text-muted-foreground">{methodUi.timeline.counters}</p>
      </div>
    </div>
  );
}

function EventText({ event }: { readonly event: TimelineEvent }) {
  const { methodUi } = useContent();
  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-report-label tabular-nums">
        <time dateTime={event.date} className="whitespace-nowrap text-label">
          {event.date}
        </time>
        <span className={event.actor === 'WAR' ? accent.text : 'text-foreground'}>
          {actorName(methodUi.timeline.actors, event.actor)}
        </span>
      </span>
      <span className="mt-1 block text-report-lead leading-tight tracking-[-0.02em] text-balance">
        {event.title}
      </span>
      {event.detail === '' ? null : (
        <span className="mt-1 block text-report-small text-muted-foreground">{event.detail}</span>
      )}
    </>
  );
}

/** Every year from 2014 to 2026, so the empty years show as well. */
function YearList() {
  const { figureTexts, methodUi } = useContent();
  const { events } = figureTexts.fig2;
  const period = periodOf(methodUi.timeline.period);
  return (
    <ol aria-label={methodUi.timeline.label}>
      {YEARS.map((year) => {
        const inYear = events.filter((event) => event.date.startsWith(String(year)));
        const inPeriod = year >= period[0] && year <= period[1];
        return (
          <li
            key={year}
            className={cn(
              'grid grid-cols-[5.5rem_minmax(0,1fr)] gap-4 border-t border-border',
              inYear.length > 0 ? 'py-6' : 'py-1',
              inPeriod && 'border-l-4 border-l-foreground pl-3',
            )}
          >
            <span
              className={cn(
                'font-mono tabular-nums',
                inYear.length > 0
                  ? 'text-report-heading leading-none'
                  : 'text-report-label text-label',
              )}
            >
              {year}
            </span>
            <div className="min-w-0">
              {year === period[0] ? (
                <p className="mb-4 font-mono text-report-label/4">{methodUi.timeline.period}</p>
              ) : null}
              {inYear.length === 0 ? null : (
                <ol className="space-y-5">
                  {inYear.map((event) => (
                    <li key={event.date + event.title}>
                      <Reveal>
                        <EventText event={event} />
                      </Reveal>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export interface ChartProps {
  readonly figure: NonNullable<ReportBlock['figure']>;
  readonly partSlug: string;
}

interface ScrollTrackProps {
  readonly index: number;
  readonly onStep: (index: number) => void;
  readonly onMissing: () => void;
}

function ScrollTrack({ index, onStep, onMissing }: ScrollTrackProps) {
  const { figureTexts, methodUi } = useContent();
  const { events } = figureTexts.fig2;
  const outer = useRef<HTMLDivElement | null>(null);
  // The report frame, not the window, scrolls the page.
  const scroller = useRef<HTMLElement | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const viewWidth = () => stage.current?.clientWidth ?? 0;
  // The page scroll in px; `scrollY` is never moved to a scroll timeline, so a transform reads it.
  const { scrollY } = useScroll({ container: scroller });
  // How far the page has scrolled past the top of the scene, from 0 to the length of the axis
  // that is out of the view.
  const shiftNow = () => {
    const node = outer.current;
    const frame = scroller.current;
    if (node === null || frame === null) return 0;
    const past = frame.getBoundingClientRect().top - node.getBoundingClientRect().top;
    return Math.min(Math.max(0, TRACK - viewWidth()), Math.max(0, past));
  };
  const shift = useTransform(scrollY, shiftNow);
  const progress = useTransform(shift, (px) => px / Math.max(1, TRACK - viewWidth()));
  const transform = useTransform(shift, (px) => `translateX(${String(-px)}px)`);
  // The cursor line crosses the view as the axis moves, so that it meets the first event at the
  // start of the scene and the last event at its end.
  const cursorX = useTransform(shift, (px) => cursorAt(px, viewWidth()));
  const line = useTransform(progress, (part) => `translateX(${String(part * viewWidth())}px)`);
  const year = useTransform(cursorX, yearAt);
  // The scroll only chooses the step: the last event at or before the cursor line.
  useMotionValueEvent(cursorX, 'change', (x) => {
    onStep(
      stepAt(
        events.map((event) => event.date),
        x,
      ),
    );
  });
  /** Scroll the page until the cursor line is on the event, so the scroll and the slider agree. */
  const select = (next: number) => {
    const event = events[next];
    const frame = scroller.current;
    if (event === undefined || frame === null) return;
    // One px more than the shift of the event passes the event.
    frame.scrollBy({ top: shiftFor(xOf(event.date), viewWidth()) - shiftNow() + 1 });
    onStep(next);
  };
  return (
    <div
      ref={(node) => {
        outer.current = node;
        scroller.current = node?.closest<HTMLElement>('[role="region"]') ?? null;
        // Without its scroll frame the axis cannot move, so the list by year replaces it.
        if (node !== null && scroller.current === null) onMissing();
      }}
      className="relative hidden lg:block"
      // One px of page scroll moves the axis by one px.
      style={{ height: `calc(var(--report-view, 100svh) + ${String(TRACK)}px - 100cqw)` }}
    >
      <div
        ref={stage}
        className={cn(
          layout.bleed,
          layout.top,
          layout.view,
          'sticky flex flex-col overflow-hidden',
        )}
        aria-label={methodUi.timeline.label}
        role="group"
      >
        <motion.p
          aria-hidden="true"
          className="pointer-events-none absolute top-4 right-8 font-mono text-report-display leading-none tracking-[-0.08em] text-foreground/10 tabular-nums"
        >
          {year}
        </motion.p>
        {/* The cursor has a row of its own, so that the event labels never pass under it. */}
        <div className="relative w-[48rem] max-w-full px-8">
          <Cursor index={index} onSelect={select} />
        </div>
        <div className="relative flex-1">
          <motion.div
            aria-hidden="true"
            style={{ transform: line }}
            className="absolute inset-y-0 left-0 w-px bg-foreground/40"
          />
          <motion.ol
            style={{ transform, width: TRACK }}
            className="absolute inset-y-0 left-0 will-change-transform"
          >
            <Axis />
            {events.map((event, place) => (
              <TrackEvent
                key={event.date + event.title}
                event={event}
                band={BANDS[place % BANDS.length] ?? BANDS[0]}
              />
            ))}
          </motion.ol>
        </div>
        <motion.div
          aria-hidden="true"
          style={{ scaleX: progress }}
          className="absolute inset-x-0 bottom-0 h-px origin-left bg-foreground"
        />
      </div>
    </div>
  );
}

function Axis() {
  const { methodUi } = useContent();
  const period = periodOf(methodUi.timeline.period);
  const periodStart = xOfYear(period[0]);
  const periodWidth = xOfYear(period[1] + 1) - periodStart;
  return (
    <li aria-hidden="true" className="absolute inset-x-0 top-1/2">
      <div className="absolute inset-x-0 h-px bg-chart-axis" />
      <div
        className={cn('absolute -top-px h-[3px]', accent.bg)}
        style={{ left: periodStart, width: periodWidth }}
      />
      {/* The label sits on the bar of the period, clear of the year labels under the axis. */}
      <p
        className={cn(
          'absolute -top-7 bg-background px-1 font-mono text-report-label whitespace-nowrap uppercase',
          accent.text,
        )}
        style={{ left: periodStart }}
      >
        {methodUi.timeline.period}
      </p>
      {/* The fold of the empty years: two slashes across the axis and their label. */}
      <div
        className="absolute -top-5 flex h-10 items-center justify-center bg-background font-mono text-report-heading text-label"
        style={{ left: xOfYear(GAP[0]) + 24, width: GAP_PX - 48 }}
      >
        //
      </div>
      <p
        className="absolute top-9 text-center font-mono text-report-label whitespace-nowrap uppercase text-label"
        style={{ left: xOfYear(GAP[0]), width: GAP_PX }}
      >
        {methodUi.timeline.gap}
      </p>
      {AXIS_YEARS.map((year) => (
        <div key={year} className="absolute top-0" style={{ left: xOfYear(year) }}>
          <div className="h-3 w-px bg-chart-axis" />
          <p className="mt-1 -translate-x-1/2 font-mono text-report-label text-label tabular-nums">
            {year}
          </p>
        </div>
      ))}
    </li>
  );
}

interface TrackEventProps {
  readonly event: TimelineEvent;
  readonly band: (typeof BANDS)[number];
}

function TrackEvent({ event, band }: TrackEventProps) {
  const war = event.actor === 'WAR';
  return (
    <li className="absolute top-1/2" style={{ left: xOf(event.date) }}>
      <span
        aria-hidden="true"
        className={cn(
          'absolute w-px',
          war ? accent.bg : 'bg-foreground/60',
          band.above ? 'bottom-0' : 'top-0',
        )}
        style={{ height: band.offset }}
      />
      <span
        aria-hidden="true"
        className={cn(
          'absolute -translate-1/2',
          war ? cn('size-4', accent.bg) : 'size-2.5 border border-foreground bg-background',
        )}
      />
      <span
        className={cn('absolute left-0 block w-40 pl-2', band.above ? '-translate-y-full' : '')}
        style={{ top: band.above ? -band.offset : band.offset }}
      >
        <EventText event={event} />
      </span>
    </li>
  );
}
