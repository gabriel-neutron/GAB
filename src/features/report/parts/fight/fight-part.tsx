import type { ReactNode } from 'react';
import type { ReportPart } from '../../content';
import { FigureFrame } from '../../figure-frame';
import { ChapterBreak } from '../../primitives/chapter-break';
import { Reveal } from '../../primitives/reveal';
import { RichText } from '../../rich-text';
import { useContent } from '../../use-content';
import { routeCounts } from './chain-data';
import { ChainStory } from './chain-story';
import { RoutesFigure } from './routes-figure';
import { SuppliersFigure } from './suppliers-figure';

// The note of the routes figure holds the counts of its data as {F.name} marks.
const fillRoutes = (note: string) =>
  note
    .replaceAll('{F.routes * 3}', String(routeCounts.steps))
    .replaceAll('{F.doc}', String(routeCounts.doc))
    .replaceAll('{F.chains}', String(routeCounts.chains))
    .replaceAll('{F.routes}', String(routeCounts.routes))
    .replaceAll('{F.all}', String(routeCounts.all));

/** Fight: a chapter break over the flintlock pistols, figure 11 at the full width of the page,
 * then, after the text, the chain story from the brand to the weapon and the routes figure. The
 * final text has no figure of the routes, so that figure has no number. */
export function FightPart({ part }: { readonly part: ReportPart }) {
  const { fightUi, figureTexts, parts } = useContent();
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const out: ReactNode[] = [];
  part.blocks.forEach((block, index) => {
    // The blocks of a part never move, so their place is their identity.
    const key = `${part.slug}-${String(index)}`;
    if (block.kind === 'figure' && block.figure !== undefined) {
      out.push(
        <FigureFrame
          key={key}
          number={block.figure.number}
          title={block.figure.title}
          unit={block.figure.unit}
          period={block.figure.period}
          sources={block.figure.sources}
          // The figure texts keep the numbers of the French publication: key 10 is figure 11.
          note={figureTexts.figures['10'].note}
          partSlug={part.slug}
        >
          <SuppliersFigure />
        </FigureFrame>,
      );
      return;
    }
    if (block.kind === 'h3') {
      out.push(
        <h3
          key={key}
          className="mt-16 mb-2 max-w-[64ch] text-report-lead text-balance lg:ml-[33.333%]"
        >
          {block.text}
        </h3>,
      );
      return;
    }
    out.push(
      <Reveal key={key}>
        <p className="my-6 max-w-[64ch] lg:ml-[33.333%]">
          <RichText text={block.text} partSlug={part.slug} />
        </p>
      </Reveal>,
    );
  });
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <ChapterBreak number={number} title={part.title} image={fightUi.image} />
      <div className="py-16 text-report-body/[1.65] md:py-24 ">
        {out}
        <ChainStory sources={fightUi.routes.sources} partSlug={part.slug} />
        <FigureFrame
          title={fightUi.routes.title}
          unit={fightUi.routes.unit}
          // The text gives no period for the routes: the frame says so, it does not stay blank.
          period={fightUi.noPeriod}
          sources={fightUi.routes.sources}
          note={fillRoutes(figureTexts.figures['11'].note)}
          partSlug={part.slug}
        >
          <RoutesFigure />
        </FigureFrame>
      </div>
    </section>
  );
}
