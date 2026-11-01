import { useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/utils';

import { LanguageSwitch } from './language-switch';
import { accent } from './primitives/accent';
import { useContent } from './use-content';

const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring';

const pad = (value: number): string => String(value).padStart(2, '0');

// A read part in the ink, the current part in a tint of the accent, a later part in the rule.
const segment = (index: number, current: number): string =>
  index < current ? 'bg-foreground/60' : index === current ? 'bg-signal/50' : 'bg-border';

/** A thin bar that sticks to the top of the report: the number and title of the part in view,
 * and one segment for each part. The segment of the part in view fills as the reader goes
 * through the part, on a light tint of the accent, so the current part shows in the accent at once.
 * Each segment is a link that shows its title in the bar on hover or focus. On a phone the bar is
 * one short line, the number and title over the same segments, so it keeps the reading space. */
export function PartBar() {
  const { openingUi, parts } = useContent();
  const bar = useRef<HTMLElement>(null);
  const fill = useRef<HTMLSpanElement | null>(null);
  // The progress of the part in view, kept past React so that a new fill span starts with it.
  const progress = useRef(0);
  const [current, setCurrent] = useState(0);
  const [pointed, setPointed] = useState<number | null>(null);

  // A subscription: the scroll of the report region moves the fills past React, and sets the part
  // whose section crosses the upper third of the view.
  useEffect(() => {
    const region = bar.current?.closest('[role="region"]');
    if (!(region instanceof HTMLElement)) return undefined;
    const sections = parts.map((part) => document.getElementById(part.slug));
    let frame = 0;
    const update = () => {
      frame = 0;
      const view = region.getBoundingClientRect();
      const mark = view.top + view.height / 3;
      let index = 0;
      sections.forEach((section, at) => {
        if (section !== null && section.getBoundingClientRect().top <= mark) index = at;
      });
      const box = sections[index]?.getBoundingClientRect();
      const inner =
        box === undefined
          ? 0
          : Math.min(1, Math.max(0, (mark - box.top) / Math.max(1, box.height)));
      progress.current = inner;
      setCurrent(index);
      fill.current?.style.setProperty('transform', `scaleX(${String(inner)})`);
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    update();
    region.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      region.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [parts]);

  const shown = pointed ?? current;
  const part = parts[shown];
  return (
    <nav
      ref={bar}
      aria-label={openingUi.partBar.label}
      // A solid ground and one hard 1px rule in every state: no fade, so no cut line shows through.
      className="sticky top-0 z-20 border-b border-border bg-background"
    >
      <div className="hidden h-11 items-center gap-8 px-6 md:flex">
        <p className="flex min-w-0 items-baseline gap-3 md:w-96 md:shrink-0">
          <span className="shrink-0 font-mono text-report-label tracking-[0.08em] text-label tabular-nums">
            <span className="text-foreground">{pad(shown + 1)}</span> {openingUi.partBar.of}{' '}
            {pad(parts.length)}
          </span>
          <span
            className={cn(
              'line-clamp-2 text-report-small leading-[1.1] tracking-[-0.01em]',
              pointed === null ? 'text-foreground' : accent.text,
            )}
          >
            {part?.title}
          </span>
        </p>
        <ol className="flex h-full min-w-0 flex-1" onMouseLeave={() => setPointed(null)}>
          {parts.map((one, index) => (
            <li key={one.slug} className="relative h-full flex-1">
              <a
                href={`#${one.slug}`}
                aria-label={`${pad(index + 1)} ${one.title}`}
                aria-current={index === current ? 'location' : undefined}
                onMouseEnter={() => setPointed(index)}
                onFocus={() => setPointed(index)}
                onBlur={() => setPointed(null)}
                className={cn('group flex h-full items-center px-0.5', FOCUS)}
              >
                <span
                  className={cn(
                    'relative h-1 w-full overflow-hidden transition-colors duration-150 group-hover:bg-signal/50 group-focus-visible:bg-signal/50',
                    segment(index, current),
                  )}
                >
                  {index === current ? (
                    <span
                      // On a part change this span mounts after the scroll update, so it reads
                      // the last progress: the new segment never stays empty.
                      ref={(node) => {
                        fill.current = node;
                        node?.style.setProperty('transform', `scaleX(${String(progress.current)})`);
                      }}
                      className={cn('absolute inset-0 origin-left', accent.bg)}
                    />
                  ) : null}
                </span>
              </a>
            </li>
          ))}
        </ol>
        {/* The switch goes to the part in view, in the other locale. */}
        <LanguageSwitch page="report" anchor={parts[current]?.slug} className="-mr-3" />
      </div>
      <div className="relative flex h-8 items-center gap-3 px-4 pb-1 md:hidden">
        <span className="shrink-0 font-mono text-report-label tracking-[0.08em] text-label tabular-nums">
          <span className="text-foreground">{pad(current + 1)}</span> {openingUi.partBar.of}{' '}
          {pad(parts.length)}
        </span>
        <span className="min-w-0 flex-1 truncate text-report-small leading-none text-foreground">
          {parts[current]?.title}
        </span>
        <LanguageSwitch
          page="report"
          anchor={parts[current]?.slug}
          className="-my-2 -mr-3 min-h-8"
        />
        <span aria-hidden="true" className="absolute inset-x-4 bottom-1 flex h-0.5 gap-0.5">
          {parts.map((one, index) => (
            <span
              key={one.slug}
              className={cn('flex-1', index === current ? accent.bg : segment(index, current))}
            />
          ))}
        </span>
      </div>
    </nav>
  );
}
