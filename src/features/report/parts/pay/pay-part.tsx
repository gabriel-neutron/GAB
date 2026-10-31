import { Fragment, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { cn } from '@/shared/lib/utils';
import { figureTexts, parts, payUi, type ReportBlock, type ReportPart } from '../../content';
import { FigureFrame } from '../../figure-frame';
import { parseMarks } from '../../marks';
import { AsciiImage } from '../../primitives/ascii-image';
import { BigNumber } from '../../primitives/big-number';
import { ChapterBreak } from '../../primitives/chapter-break';
import { layout } from '../../primitives/layout';
import { Reveal } from '../../primitives/reveal';
import { StickyScene } from '../../primitives/sticky-scene';
import { RichText } from '../../rich-text';
import { BudgetChart, BuyersChart, PriceChart } from './pay-figures';

// The editorial grid: the notes hang in the left third, the text reads in the right two thirds.
const ROW = 'lg:grid lg:grid-cols-12 lg:gap-x-10';
const TEXT = 'max-w-[64ch] text-[18px]/[1.65] md:text-[20px]/[1.65] lg:col-span-8 lg:col-start-5';
const KEY = /^\*\*([^*]+?):?\*\*:?\s*/;
// The paragraph after which the two values of the part stand alone.
const NUMBERS_AFTER = 'In total, across all goods';
// A wide figure: past the reading column, up to the width of a large screen.
const WIDE = cn(layout.bleed, 'px-4 md:px-8');
const WIDE_INNER = 'mx-auto max-w-[1376px]';

/** Part "Pay": the tanker break, the text on an editorial grid with its notes in the margin,
 * figures 3 and 5 wide, figure 4 as a scroll scene of the price caps and the gap, and the two
 * big values of the part. */
export function PayPart({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const out: ReactNode[] = [];
  let reasons: ReportBlock[] = [];
  const closeReasons = () => {
    if (reasons.length === 0) return;
    out.push(<Reasons key={`reasons-${reasons[0]?.text ?? ''}`} blocks={reasons} part={part} />);
    reasons = [];
  };
  for (const block of part.blocks) {
    if (block.kind === 'li') {
      reasons.push(block);
      continue;
    }
    closeReasons();
    if (block.kind === 'figure' && block.figure !== undefined) {
      out.push(<Figure key={block.text} figure={block.figure} slug={part.slug} />);
      continue;
    }
    out.push(
      <Reveal key={block.text}>
        <div className={cn(ROW, 'my-6')}>
          <Sidenotes text={block.text} part={part} />
          <p className={TEXT}>
            <RichText text={block.text} partSlug={part.slug} />
          </p>
        </div>
      </Reveal>,
    );
    if (block.text.includes(NUMBERS_AFTER)) out.push(<Numbers key="numbers" slug={part.slug} />);
  }
  closeReasons();
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <PayBreak number={number} title={part.title} />
      <div className="py-16 md:py-24">{out}</div>
    </section>
  );
}

/** The chapter break over a band of the tanker in ASCII. The numeral stands on the art; the
 * label and the credit of the art close the break, clear of the art at each width. */
function PayBreak({ number, title }: { readonly number: string; readonly title: string }) {
  const { image } = payUi;
  const caption = (
    <>
      <span className="block uppercase">{image.label}</span>
      <span className="block">{image.credit}</span>
    </>
  );
  return (
    // From 768px to 1024px the break takes the height of its words, not of the view.
    <div className="relative md:max-lg:[&>.isolate]:min-h-0">
      <div
        className={cn(
          'absolute top-6 left-[calc(50%-50cqw)] w-[100cqw] md:top-10',
          'lg:top-auto lg:bottom-[22%]',
        )}
      >
        {/* On a phone a taller crop keeps the ship legible at the few columns of the screen. */}
        <div className="relative aspect-video md:aspect-[1920/728] [&_pre]:text-foreground/70">
          <AsciiImage src={image.src} alt={image.alt} />
          {/* The scrim keeps the numeral and the title clear of the art on a large screen. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden bg-linear-to-t from-background via-background/40 to-transparent lg:block"
          />
        </div>
      </div>
      <ChapterBreak number={number} title={title} quote={payUi.quote}>
        <p className="mt-10 font-mono text-small/4 text-label lg:hidden">{caption}</p>
      </ChapterBreak>
      <p className="absolute right-8 bottom-6 hidden text-right font-mono text-small/4 whitespace-nowrap text-label lg:block">
        {caption}
      </p>
    </div>
  );
}

/** The notes of one paragraph, in full, in the left margin of a large screen. On a smaller
 * screen each marker opens its note. */
function Sidenotes({ text, part }: { readonly text: string; readonly part: ReportPart }) {
  const ids = parseMarks(text).flatMap((run) => (run.kind === 'note' ? [run.id] : []));
  const notes = ids.flatMap((id) => part.notes.filter((note) => note.id === id));
  if (notes.length === 0) return null;
  return (
    <aside
      aria-label={payUi.sidenotes}
      className="hidden min-w-0 border-t border-border pt-2 lg:col-span-4 lg:block"
    >
      {notes.map((note) => (
        <p key={note.id} className="mb-3 text-caption/[1.5] break-words text-muted-foreground">
          <span className="mr-2 font-mono text-label">
            {note.id.slice(note.id.lastIndexOf('-') + 1)}
          </span>
          <RichText text={note.text} />
        </p>
      ))}
    </aside>
  );
}

/** The two values of the part as one full-width beat, in two equal columns, so that the two
 * values take the same size, the same baseline and the same width of label. */
function Numbers({ slug }: { readonly slug: string }) {
  return (
    <div className={cn(layout.bleed, 'my-12 border-y border-border md:my-16')}>
      <div className="mx-auto grid max-w-[1376px] items-start gap-12 px-4 py-12 md:grid-cols-2 md:gap-10 md:px-8 md:py-16">
        {payUi.numbers.map((one) => (
          <Reveal key={one.value}>
            <BigNumber
              value={one.value}
              label={one.label}
              note={{ partSlug: slug, id: one.note }}
            />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/** The two reasons of the shift to Asia, each under its key word in large type. */
function Reasons({
  blocks,
  part,
}: {
  readonly blocks: readonly ReportBlock[];
  readonly part: ReportPart;
}) {
  return (
    <ul className="my-10">
      {blocks.map((block) => {
        const match = KEY.exec(block.text);
        return (
          <li key={block.text} className={ROW}>
            <Sidenotes text={block.text} part={part} />
            <div className={cn(TEXT, 'border-t border-border py-6')}>
              <Reveal>
                <span className="block text-[clamp(1.75rem,4vw,2.5rem)] leading-none tracking-[-0.03em]">
                  {match?.[1]}
                </span>
                <span className="mt-3 block">
                  <RichText
                    text={match === null ? block.text : block.text.slice(match[0].length)}
                    partSlug={part.slug}
                  />
                </span>
              </Reveal>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

type FigureFacts = NonNullable<ReportBlock['figure']>;

/** One figure of the part in its frame, wider than the text. */
function Figure({ figure, slug }: { readonly figure: FigureFacts; readonly slug: string }) {
  const chart =
    figure.number === 3 ? (
      <BuyersChart />
    ) : figure.number === 5 ? (
      <BudgetChart />
    ) : (
      <PriceScene slug={slug} />
    );
  const note =
    figure.number === 3
      ? figureTexts.figures['3'].note
      : figure.number === 5
        ? figureTexts.figures['5'].note
        : payUi.f4.note;
  return (
    <div className={WIDE}>
      <div className={WIDE_INNER}>
        <FigureFrame
          number={figure.number}
          title={figure.title}
          unit={figure.unit}
          period={figure.period}
          sources={figure.sources}
          note={note}
          partSlug={slug}
        >
          {chart}
        </FigureFrame>
      </div>
    </div>
  );
}

/** One step of figure 4 as an annotation: the date in the accent, a rule toward the chart, and
 * the quoted text. */
function StepText({
  step,
  slug,
}: {
  readonly step: (typeof payUi.f4.steps)[number];
  readonly slug: string;
}) {
  return (
    <>
      <span className="block font-mono text-caption uppercase text-signal">{step.kicker}</span>
      <span aria-hidden="true" className="mt-3 block h-px bg-signal lg:-mr-10" />
      <span className="mt-3 block">
        <RichText text={step.text} partSlug={slug} />
      </span>
    </>
  );
}

// The cards of the scene: under 1024px they only drive the scroll, and the caption bar of the
// chart shows the step in view; on a large screen they are open annotations in the left third.
const CARD = 'invisible w-full text-body lg:visible lg:w-[calc(100%/3-1.5rem)]';

/** Figure 4 as a scroll scene: each step shows one more state of the caps and the gap. Under
 * reduced motion, one chart in its final state; the body text holds the words of the steps. */
function PriceScene({ slug }: { readonly slug: string }) {
  const reduce = useReducedMotion();
  if (reduce === true) return <PriceChart step={3} />;
  const steps = payUi.f4.steps;
  return (
    // The last step ends the scene: no empty view stays after it.
    <div className="[&>div>div:last-child>div:last-child]:hidden">
      <StickyScene
        sceneClassName="pointer-events-none z-10"
        stepClassName={CARD}
        steps={steps.map((step) => (
          <Fragment key={step.kicker}>
            <StepText step={step} slug={slug} />
          </Fragment>
        ))}
      >
        {(active) => {
          const step = steps[active];
          return (
            <div className={cn('flex flex-col bg-background lg:bg-transparent', layout.view)}>
              <div className="pointer-events-auto flex h-[52%] shrink-0 flex-col bg-background pt-2 pb-2 lg:ml-[calc(100%/3+1rem)] lg:h-full lg:py-8">
                <PriceChart step={active + 1} focus fill />
              </div>
              {step === undefined ? null : (
                <div className="pointer-events-auto min-h-0 flex-1 overflow-hidden border-t border-border pt-3 text-body-sm md:text-body lg:hidden">
                  <StepText step={step} slug={slug} />
                </div>
              )}
            </div>
          );
        }}
      </StickyScene>
    </div>
  );
}
