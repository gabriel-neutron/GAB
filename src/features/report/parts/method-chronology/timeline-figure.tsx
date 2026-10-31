import { useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { figureTexts, methodUi, type ReportBlock } from '../../content';
import { accent } from '../../primitives/accent';
import { layout } from '../../primitives/layout';
import { Reveal } from '../../primitives/reveal';

type TimelineEvent = (typeof figureTexts.fig2.events)[number];
const { events, legend } = figureTexts.fig2;

const START = 2014;
const END = 2027;
const YEARS = Array.from({ length: END - START }, (_, index) => START + index);
// The years the text names as the period of the report, read from the quoted sentence.
const [PERIOD_FROM = START, PERIOD_TO = END - 1] = (
  methodUi.timeline.period.match(/\d{4}/g) ?? []
).map(Number);
const PERIOD = [PERIOD_FROM, PERIOD_TO] as const;
// The figure has no event from 2015 to 2021, so the axis folds these years into one gap.
const GAP = [2015, 2022] as const;
const GAP_PX = 320;
// 340px for one year keeps 160px labels clear of the next stem in the same band.
const PX_PER_YEAR = 340;
const PAD = 96;
const TRACK = (END - START - (GAP[1] - GAP[0])) * PX_PER_YEAR + GAP_PX + 2 * PAD;
const AXIS_YEARS = YEARS.filter((year) => year <= GAP[0] || year >= GAP[1]);
const YEAR_MS = 365.25 * 24 * 3600 * 1000;
/** The place on the axis of a time in years, for example 2022.5. */
const xOfTime = (time: number): number => {
  if (time <= GAP[0]) return PAD + (time - START) * PX_PER_YEAR;
  const gapStart = PAD + (GAP[0] - START) * PX_PER_YEAR;
  if (time < GAP[1]) return gapStart + ((time - GAP[0]) / (GAP[1] - GAP[0])) * GAP_PX;
  return gapStart + GAP_PX + (time - GAP[1]) * PX_PER_YEAR;
};
const xOf = (date: string): number =>
  xOfTime(START + (Date.parse(date) - Date.UTC(START, 0, 1)) / YEAR_MS);
const xOfYear = (year: number): number => xOfTime(year);
/** The year under a place on the axis, or the gap label inside the gap. */
const yearAt = (x: number): string => {
  const gapStart = xOfTime(GAP[0]);
  if (x < gapStart) return String(Math.max(START, START + Math.floor((x - PAD) / PX_PER_YEAR)));
  if (x < gapStart + GAP_PX) return '//';
  return String(Math.min(END - 1, GAP[1] + Math.floor((x - gapStart - GAP_PX) / PX_PER_YEAR)));
};
const actorName = (actor: string): string => methodUi.timeline.actors[actor] ?? actor;

// Four bands of labels, so that close dates do not overlap: far above, far below, near above,
// near below. The offset is from the axis, in px.
const BANDS = [
  { above: true, offset: 150 },
  { above: false, offset: 150 },
  { above: true, offset: 40 },
  { above: false, offset: 40 },
] as const;

/** Figure 2: the sanctions from 2014 to 2026. On a wide screen, the page scroll moves a time axis
 * across the view, at true scale outside the fold of the empty years. On a phone, under reduced
 * motion, and when no scroll frame is found, it is a list by year. */
export function TimelineFigure() {
  const reduce = useReducedMotion();
  const [track, setTrack] = useState(true);
  return (
    <>
      {reduce === true || !track ? (
        <YearList />
      ) : (
        <>
          <div className="lg:hidden">
            <YearList />
          </div>
          <ScrollTrack
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
              {actorName(key)}
            </dt>
            <dd className="text-report-small text-muted-foreground">{name}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}

function EventText({ event }: { readonly event: TimelineEvent }) {
  return (
    <>
      <span className="flex flex-wrap items-baseline gap-x-2 font-mono text-report-label tabular-nums">
        <time dateTime={event.date} className="whitespace-nowrap text-label">
          {event.date}
        </time>
        <span className={event.actor === 'WAR' ? accent.text : 'text-foreground'}>
          {actorName(event.actor)}
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
  return (
    <ol aria-label={methodUi.timeline.label}>
      {YEARS.map((year) => {
        const inYear = events.filter((event) => event.date.startsWith(String(year)));
        const inPeriod = year >= PERIOD[0] && year <= PERIOD[1];
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
              {year === PERIOD[0] ? (
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

function ScrollTrack({ onMissing }: { readonly onMissing: () => void }) {
  const outer = useRef<HTMLDivElement | null>(null);
  // The report frame, not the window, scrolls the page.
  const scroller = useRef<HTMLElement | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const viewWidth = () => stage.current?.clientWidth ?? 0;
  // The page scroll in px; `scrollY` is never moved to a scroll timeline, so a transform reads it.
  const { scrollY } = useScroll({ container: scroller });
  // How far the page has scrolled past the top of the scene, from 0 to the length of the axis
  // that is out of the view.
  const shift = useTransform(scrollY, () => {
    const node = outer.current;
    const frame = scroller.current;
    if (node === null || frame === null) return 0;
    const past = frame.getBoundingClientRect().top - node.getBoundingClientRect().top;
    return Math.min(Math.max(0, TRACK - viewWidth()), Math.max(0, past));
  });
  const progress = useTransform(shift, (px) => px / Math.max(1, TRACK - viewWidth()));
  const transform = useTransform(shift, (px) => `translateX(${String(-px)}px)`);
  // The year under the play line in the middle of the view.
  const year = useTransform(shift, (px) => yearAt(px + viewWidth() / 2));
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
        className={cn(layout.bleed, layout.top, layout.view, 'sticky overflow-hidden')}
        aria-label={methodUi.timeline.label}
        role="group"
      >
        <div aria-hidden="true" className="absolute inset-y-0 left-1/2 w-px bg-foreground/15" />
        <motion.p
          aria-hidden="true"
          className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 font-mono text-report-display leading-none tracking-[-0.08em] text-foreground/10 tabular-nums"
        >
          {year}
        </motion.p>
        <motion.ol
          style={{ transform, width: TRACK }}
          className="absolute inset-y-0 left-0 will-change-transform"
        >
          <Axis />
          {events.map((event, index) => (
            <TrackEvent
              key={event.date + event.title}
              event={event}
              band={BANDS[index % BANDS.length] ?? BANDS[0]}
            />
          ))}
        </motion.ol>
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
  const periodStart = xOfYear(PERIOD[0]);
  const periodWidth = xOfYear(PERIOD[1] + 1) - periodStart;
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
