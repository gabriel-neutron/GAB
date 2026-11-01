import { Fragment, useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import type { ReportBlock, ReportPart } from '../../content';
import { FigureFrame } from '../../figure-frame';
import { AsciiImage } from '../../primitives/ascii-image';
import { ChapterBreak } from '../../primitives/chapter-break';
import { layout } from '../../primitives/layout';
import { Reveal } from '../../primitives/reveal';
import { StickyScene } from '../../primitives/sticky-scene';
import { RichText } from '../../rich-text';
import { useContent, type ReportContent } from '../../use-content';
import { CapWhatIf, WHAT_IF_START, WhatIfControls, WhatIfTable, whatIfLabel } from './cap-what-if';
import { BudgetChart, BuyersChart, PriceChart } from './pay-figures';
import { useReduceMotion } from '../../reduced-motion';
import { useNarrowScreen } from '@/shared/narrow-screen';

// The editorial grid: from 1280px the text reads in the right two thirds, and a note opens in the
// left third. Under 1280px a note opens in a sheet, so the text keeps the full column.
const ROW = 'xl:grid xl:grid-cols-12 xl:gap-x-10';
const TEXT = 'max-w-[64ch] text-report-body/[1.65] xl:col-span-8 xl:col-start-5';
const KEY = /^\*\*([^*]+?)\s?:?\*\*:?\s*/; // A French key has a space before its colon.
// A wide figure: past the reading column, up to the width of a large screen.
const WIDE = cn(layout.bleed, 'px-4 md:px-8');
const WIDE_INNER = 'mx-auto max-w-[1376px]';

/** Part "Pay": the oil-derrick break, the text on an editorial grid with a margin for its notes,
 * figures 3 and 5 wide, and figure 4 as a scroll scene of the price caps and the gap. */
export function PayPart({ part }: { readonly part: ReportPart }) {
  const { parts } = useContent();
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
    if (block.kind === 'h3') {
      out.push(
        <div key={block.text} className={ROW}>
          <h3 className={cn(TEXT, 'mt-14 mb-2 text-report-lead text-balance')}>{block.text}</h3>
        </div>,
      );
      continue;
    }
    if (block.kind === 'figure' && block.figure !== undefined) {
      out.push(<Figure key={block.text} figure={block.figure} slug={part.slug} />);
      continue;
    }
    out.push(
      <Reveal key={block.text}>
        <div className={cn(ROW, 'my-6')}>
          <p className={TEXT}>
            <RichText text={block.text} partSlug={part.slug} />
          </p>
        </div>
      </Reveal>,
    );
  }
  closeReasons();
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <PayBreak number={number} title={part.title} />
      <div className="py-16 md:py-24">{out}</div>
    </section>
  );
}

/** The chapter break over a decorative band of the Baku oil derricks in ASCII. The numeral stands
 * on the art. */
function PayBreak({ number, title }: { readonly number: string; readonly title: string }) {
  const { payUi } = useContent();
  return (
    // From 768px to 1024px the break takes the height of its words, not of the view.
    <div className="relative md:max-lg:[&>.isolate]:min-h-0">
      <div
        className={cn(
          'absolute top-6 left-[calc(50%-50cqw)] w-[100cqw] md:top-10',
          'lg:top-auto lg:bottom-[22%]',
        )}
      >
        {/* On a phone a taller crop keeps the derricks legible at the few columns of the screen. */}
        <div className="relative aspect-video md:aspect-[1355/565] [&_pre]:text-foreground/70">
          <AsciiImage src={payUi.image} />
          {/* The scrim keeps the numeral and the title clear of the art at every width. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-transparent"
          />
        </div>
      </div>
      <ChapterBreak number={number} title={title} credit={payUi.image} />
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
            <div className={cn(TEXT, 'border-t border-border py-6')}>
              <Reveal>
                <span className="block text-report-lead leading-none tracking-[-0.03em]">
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
  const { figureTexts, payUi } = useContent();
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

/** One step of figure 4 as an annotation: a rule toward the chart, and the quoted text. */
function StepText({
  step,
  slug,
}: {
  readonly step: ReportContent['payUi']['f4']['steps'][number];
  readonly slug: string;
}) {
  return (
    <>
      <span aria-hidden="true" className="block h-px bg-signal lg:-mr-10" />
      <span className="mt-3 block">
        <RichText text={step.text} partSlug={slug} />
      </span>
    </>
  );
}

// The cards of the scene: under 1024px they only drive the scroll, and the caption bar of the
// chart shows the step in view; on a large screen they are open annotations in the left third.
const CARD = 'invisible w-full text-report-small lg:visible lg:w-[calc(100%/3-1.5rem)]';

/** Figure 4 as a scroll scene: each step shows one more state of the caps and the gap, and the
 * last step adds the what-if line that the reader moves, in the same chart. Under reduced motion
 * and under 768px, only the chart with the what-if line; the body text holds the words of the steps. */
function PriceScene({ slug }: { readonly slug: string }) {
  const { payUi } = useContent();
  const reduce = useReduceMotion();
  const narrow = useNarrowScreen();
  const [line, setLine] = useState(WHAT_IF_START);
  // Under reduced motion and on a phone, the chart of the what-if line is the one chart in its
  // final state: no scroll step only moves a mark, and the page scroll is never held.
  if (reduce || narrow) return <CapWhatIf />;
  const steps = payUi.f4.steps;
  const controls = <WhatIfControls line={line} onLine={setLine} />;
  return (
    <>
      {/* The last step ends the scene: no empty view stays after it. */}
      <div className="[&>div>div:last-child>div:last-child]:hidden">
        <StickyScene
          sceneClassName="pointer-events-none z-10"
          stepClassName={CARD}
          steps={[
            ...steps.map((step) => (
              <Fragment key={step.text}>
                <StepText step={step} slug={slug} />
              </Fragment>
            )),
            <Fragment key="what-if">{controls}</Fragment>,
          ]}
        >
          {(active) => {
            const step = steps[active];
            const whatIf = active >= steps.length;
            return (
              <div className={cn('flex flex-col bg-background lg:bg-transparent', layout.view)}>
                <div className="pointer-events-auto flex h-[52%] shrink-0 flex-col bg-background pt-2 pb-2 lg:ml-[calc(100%/3+1rem)] lg:h-full lg:py-8">
                  <PriceChart
                    step={Math.min(active + 1, steps.length)}
                    focus={!whatIf}
                    fill
                    whatIf={
                      whatIf
                        ? { value: line, label: whatIfLabel(payUi.f4.whatIf, line) }
                        : undefined
                    }
                  />
                </div>
                <div
                  aria-live={whatIf ? undefined : 'polite'}
                  className="pointer-events-auto min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border pt-3 text-report-small lg:hidden"
                >
                  {whatIf ? (
                    controls
                  ) : step === undefined ? null : (
                    <StepText step={step} slug={slug} />
                  )}
                </div>
              </div>
            );
          }}
        </StickyScene>
      </div>
      <WhatIfTable line={line} />
    </>
  );
}
