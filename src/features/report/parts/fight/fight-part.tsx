import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { fightUi, figureTexts, parts, type ReportBlock, type ReportPart } from '../../content';
import { FigureFrame } from '../../figure-frame';
import { BigNumber } from '../../primitives/big-number';
import { ChapterBreak } from '../../primitives/chapter-break';
import { Reveal } from '../../primitives/reveal';
import { RichText } from '../../rich-text';
import { routeCounts } from './chain-data';
import { ChainStory } from './chain-story';
import { RoutesFigure } from './routes-figure';
import { SuppliersFigure } from './suppliers-figure';

// The note of figure 11 holds the counts of its data as {F.name} marks.
const routesNote = figureTexts.figures['11'].note
  .replaceAll('{F.routes * 3}', String(routeCounts.steps))
  .replaceAll('{F.doc}', String(routeCounts.doc))
  .replaceAll('{F.chains}', String(routeCounts.chains))
  .replaceAll('{F.routes}', String(routeCounts.routes))
  .replaceAll('{F.all}', String(routeCounts.all));

const NOTES: Readonly<Record<number, string>> = {
  10: figureTexts.figures['10'].note,
  11: routesNote,
};

/** Fight: a chapter break over the flintlock pistols, figure 10 at the full width of the page,
 * two values alone, the chain story from the brand to the weapon, and figure 11. */
export function FightPart({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const [share, premium] = fightUi.numbers;
  const out: ReactNode[] = [];
  const figureOf = (block: ReportBlock, chart: ReactNode) =>
    block.figure === undefined ? null : (
      <FigureFrame
        number={block.figure.number}
        title={block.figure.title}
        unit={block.figure.unit}
        // The text gives no period for figure 11: the frame says so, it does not stay blank.
        period={block.figure.period === '' ? fightUi.noPeriod : block.figure.period}
        sources={block.figure.sources}
        note={NOTES[block.figure.number]}
        partSlug={part.slug}
      >
        {chart}
      </FigureFrame>
    );
  // The label of the primitive is a small caption: here it is set larger.
  const number_ = (one: (typeof fightUi.numbers)[number] | undefined, aside?: ReactNode) =>
    one === undefined ? null : (
      <div
        key={one.note}
        className={cn(
          'my-16 grid items-end gap-10 border-y border-border py-10 md:my-24 md:gap-16 [&_p:nth-of-type(2)]:text-[14px]/5',
          aside !== undefined && 'md:grid-cols-2',
        )}
      >
        <BigNumber
          value={one.value}
          label={one.label}
          note={{ partSlug: part.slug, id: one.note }}
        />
        {aside}
      </div>
    );
  part.blocks.forEach((block, index) => {
    // The blocks of a part never move, so their place is their identity.
    const key = `${part.slug}-${String(index)}`;
    if (block.kind === 'figure') {
      if (block.figure?.number === 11)
        out.push(
          <ChainStory
            key={`${key}-story`}
            figure={block.figure}
            text={block.text}
            partSlug={part.slug}
          />,
        );
      out.push(
        <div key={key}>
          {figureOf(block, block.figure?.number === 10 ? <SuppliersFigure /> : <RoutesFigure />)}
        </div>,
      );
      if (block.figure?.number === 10) out.push(number_(share));
      return;
    }
    out.push(
      <Reveal key={key}>
        <p className="my-6 max-w-[64ch] lg:ml-[33.333%]">
          <RichText text={block.text} partSlug={part.slug} />
        </p>
      </Reveal>,
    );
    // The value of the price paragraph stands alone after it (the test checks that block 3 is it).
    if (index === 3) out.push(number_(premium));
  });
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ChapterBreak
        number={number}
        title={part.title}
        quote={fightUi.quote}
        image={fightUi.image}
      />
      <div className="py-16 text-[18px]/[1.65] md:py-24 md:text-[20px]/[1.65]">{out}</div>
    </section>
  );
}
