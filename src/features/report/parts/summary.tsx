import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { openingUi, parts, type ReportPart } from '../content';
import figures from '../data/publication-figures.json';
import { NoteRef } from '../note-ref';
import { accent } from '../primitives/accent';
import { chapterHead } from '../primitives/chapter-break';
import { monoLabel } from '../primitives/label';
import { NumberRoll } from '../primitives/number-roll';
import { Reveal } from '../primitives/reveal';
import { RichText } from '../rich-text';
import { ScaleCounters } from '../scale-counters';
import { ScrambleText } from '../scramble-text';

const KEY = /^\*\*([^*]+?):\*\*\s*/;
/** The bold key and the first sentence of a paragraph, with the space after it. */
const leadHead = (text: string): string =>
  /^(?:\*\*[^*]+\*\*\s*)?[^.?!]*[.?!]\s*/.exec(text)?.[0] ?? text;
const SENTENCE = 'text-[18px]/[1.55] text-foreground/75 md:text-[19px]/[1.55]';
const WORDS = 'leading-[0.9] tracking-[-0.045em] text-balance';
const { summary: copy } = openingUi;

interface Finding {
  readonly index: number;
  readonly key: string;
  readonly value: string;
  readonly label: string;
  readonly note: string;
  readonly sentence: ReactNode;
}

/** The short label and the note mark directly under a value. */
const caption = (finding: Finding, className?: string) => (
  <p className={cn('mt-4 flex max-w-[44ch] gap-3', monoLabel, className)}>
    <span
      aria-hidden="true"
      className={cn('mt-[0.6em] inline-block h-px w-6 shrink-0', accent.bg)}
    />
    <span>
      {finding.label}
      <NoteRef partSlug="summary" id={finding.note} />
    </span>
  </p>
);

const tag = (finding: Finding, repeat = false) => (
  <p className={monoLabel}>
    <span className="text-foreground tabular-nums">
      {String(finding.index + 1).padStart(2, '0')}
    </span>
    <span aria-hidden="true"> · </span>
    {finding.key}
    {repeat ? (
      <>
        <span aria-hidden="true"> · </span>
        <span className={accent.text}>{copy.repeat}</span>
      </>
    ) : null}
  </p>
);

/** A small column chart of the rouble share of export settlements, from the data of figure 9.
 * The two years of the text carry the accent and their value. */
function RoubleChart() {
  const { chart } = copy;
  const points = figures.f9.exports.Rouble.map(([year = 0, value = 0]) => [year, value] as const);
  const top = Math.max(...points.map(([, value]) => value));
  return (
    <figure className="m-0 border-t border-border pt-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-body-sm text-foreground">{chart.title}</span>
        <span className={monoLabel}>
          {chart.unit} · {chart.period}
        </span>
      </figcaption>
      <ol aria-label={chart.label} className="mt-6 grid h-44 grid-cols-7">
        {points.map(([year, value]) => {
          const marked = chart.marked.some((one) => one === year);
          return (
            <li key={year} className="flex h-full flex-col">
              <span className="sr-only">
                {year}: {Math.round(value)}%
              </span>
              {/* Every bar prints its value, as figure 9 does; the two years of the text in the accent. */}
              <div
                aria-hidden="true"
                className="flex flex-1 flex-col items-center justify-end border-b border-foreground/40"
              >
                <span
                  className={cn(
                    'mb-2 font-mono tabular-nums',
                    marked ? cn('text-[13px]', accent.text) : 'text-[11px] text-label',
                  )}
                >
                  {Math.round(value)}%
                </span>
                <span
                  className={cn('block w-1', marked ? accent.bg : 'bg-foreground/60')}
                  style={{ height: `${String((value / top) * 70)}%` }}
                />
              </div>
              <span
                aria-hidden="true"
                className={cn(
                  'mt-2 text-center font-mono text-[11px] tabular-nums',
                  marked ? 'text-foreground' : 'text-label',
                )}
              >
                {year}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-body-sm text-foreground/75">
        {chart.source}
        <NoteRef partSlug={chart.note.part} id={chart.note.id} />
      </p>
    </figure>
  );
}

// Every finding has the same layout on one 12-column grid: the value across 7 columns, its
// caption and its sentence in the other 5, from the top of the value. One rule for the value: a
// number in the accent, words in the ink, and the outline only for the value of the cover.
// The value that the cover shows too.
const repeats = (finding: Finding): boolean => finding.value === openingUi.coverNumber.value;
const NUMBER = 'text-[clamp(5rem,24vw,15rem)] leading-[0.8] tracking-[-0.07em] tabular-nums';

function hero(finding: Finding): ReactNode {
  if (repeats(finding))
    return (
      <p
        className={cn(
          NUMBER,
          'text-transparent [-webkit-text-stroke:2px_var(--signal)] md:[-webkit-text-stroke:3px_var(--signal)]',
        )}
      >
        <NumberRoll value={finding.value} />
      </p>
    );
  if (/\d/.test(finding.value))
    return (
      <p className={cn(NUMBER, accent.text)}>
        <NumberRoll value={finding.value} />
      </p>
    );
  return <p className={cn('max-w-[10ch] text-[clamp(3rem,8vw,7.5rem)]', WORDS)}>{finding.value}</p>;
}

const layout = (finding: Finding): ReactNode => (
  <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8">
    <div className="min-w-0 lg:col-span-7">
      {tag(finding, repeats(finding))}
      <div className="mt-4">{hero(finding)}</div>
    </div>
    {/* The top padding sets the caption level with the top of the value, under its tag. */}
    <div className="min-w-0 lg:col-span-5 lg:pt-9">
      {caption(finding)}
      <p className={cn('mt-6', SENTENCE)}>{finding.sentence}</p>
      {/* The finding on the rouble has the small chart of its data. */}
      {finding.note === copy.chart.finding ? (
        <div className="mt-8">
          <RoubleChart />
        </div>
      ) : null}
    </div>
  </div>
);

/** The summary: the chapter opening (numeral and title), the problem as a pull sentence, the
 * method and the result under it, then each finding of the list as one value on the same grid,
 * then the scale of the research. On a phone the opening is one row, so that the first screen
 * shows the start of the text. */
export function SummaryPart({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const [lead, ...rest] = part.blocks.filter((block) => block.kind === 'p');
  const findings = part.blocks.filter((block) => block.kind === 'li');
  return (
    <section
      id={part.slug}
      aria-labelledby={`${part.slug}-title`}
      className="scroll-mt-[calc(var(--report-bar,0px)+1px)] pt-3 pb-4 md:pt-16 md:pb-8"
    >
      {/* The head of every chapter break, without the break: the cover is the pause before it. */}
      <div className="relative">
        <div className={chapterHead.row}>
          <p aria-hidden="true" className={chapterHead.number}>
            {number}
          </p>
          <h2 id={`${part.slug}-title`} className={chapterHead.title}>
            <ScrambleText text={part.title} />
          </h2>
        </div>
        {/* On a wide screen, a plate in the empty right half of the head, as in the other
            chapter breaks. On a phone the first screen keeps the start of the text. */}
        <figure className="m-0 hidden lg:absolute lg:top-0 lg:right-0 lg:block lg:w-[46%]">
          <img
            src={copy.art.src}
            alt={copy.art.alt}
            loading="lazy"
            decoding="async"
            // The dither is black on white: it multiplies onto paper, and inverts onto the dark.
            className="block aspect-[16/10] w-full object-cover mix-blend-multiply [image-rendering:pixelated] dark:mix-blend-screen dark:invert"
          />
          <figcaption className="mt-2 font-mono text-[12px]/4 text-label">
            <span className="tracking-[0.08em] text-foreground uppercase">{copy.art.label}</span>{' '}
            <a
              href={copy.art.href}
              className="underline decoration-border underline-offset-2 hover:text-foreground"
            >
              {copy.art.credit}
            </a>
          </figcaption>
        </figure>
      </div>
      <div className="mt-4 md:mt-14 lg:grid lg:grid-cols-12 lg:gap-x-8">
        {lead === undefined ? null : (
          <div className="lg:col-span-10">
            {/* Only the first sentence of the problem stays large; the rest reads as body text. */}
            <p className="max-w-[56ch] text-[20px]/[1.4] tracking-[-0.01em] text-balance md:text-[clamp(1.5rem,2.4vw,2rem)]/[1.25] md:tracking-[-0.02em]">
              <RichText text={leadHead(lead.text)} partSlug={part.slug} />
            </p>
            <p className={cn('mt-4 max-w-[64ch]', SENTENCE)}>
              <RichText text={lead.text.slice(leadHead(lead.text).length)} partSlug={part.slug} />
            </p>
          </div>
        )}
        <div className="mt-10 grid gap-8 md:mt-14 md:grid-cols-2 md:gap-10 lg:col-span-12">
          {rest.map((block) => (
            <p key={block.text} className={SENTENCE}>
              <RichText text={block.text} partSlug={part.slug} />
            </p>
          ))}
        </div>
      </div>
      <h3 className={cn('mt-16 border-t border-foreground pt-3 md:mt-16 lg:mt-24', monoLabel)}>
        {copy.findings}
      </h3>
      <ol>
        {findings.map((block, index) => {
          const match = KEY.exec(block.text);
          const sentence = match === null ? block.text : block.text.slice(match[0].length);
          const value = copy.values[index];
          return (
            <li key={block.text} className="border-b border-border py-8 lg:py-12">
              <Reveal>
                {layout({
                  index,
                  key: match?.[1] ?? '',
                  value: value?.value ?? '',
                  label: value?.label ?? '',
                  note: value?.note ?? '',
                  sentence: <RichText text={sentence} partSlug={part.slug} />,
                })}
              </Reveal>
            </li>
          );
        })}
      </ol>
      <ScaleCounters />
    </section>
  );
}
