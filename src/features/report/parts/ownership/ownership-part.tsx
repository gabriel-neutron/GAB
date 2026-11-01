import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import type { ReportPart } from '../../content';
import { FigureFrame } from '../../figure-frame';
import { AsciiImage } from '../../primitives/ascii-image';
import { ChapterBreak } from '../../primitives/chapter-break';
import { layout } from '../../primitives/layout';
import { Reveal } from '../../primitives/reveal';
import { RichText } from '../../rich-text';
import { useContent } from '../../use-content';
import { OwnersMap } from './owners-map';
import { OwnershipFigure } from './ownership-figure';

// One body size for all the text of the part. A node reference keeps a thin dotted underline.
const PROSE = 'max-w-[64ch] text-report-body/[1.65] text-pretty  [&_button]:decoration-dotted';
// From 1280px the text reads at the right, and a note opens in the margin at its left; under 1280px
// the note opens in a sheet, so the text keeps the full column.
const ROW = 'xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,64ch)] xl:gap-x-16';

/** The chapter break over the chess set: the decorative ASCII art sits at the top right, behind a
 * scrim, so the title stays on near-black ground. */
function Opening({ number, title }: { readonly number: string; readonly title: string }) {
  const { ownershipUi } = useContent();
  return (
    <div
      className={cn(
        layout.bleed,
        'isolate',
        // On a phone, the numeral is at least as tall as the title block.
        "max-md:[&_p[aria-hidden='true']]:text-[64vw]",
      )}
    >
      <div className="absolute top-24 right-0 h-[50%] w-full md:top-0 md:h-[78%] md:w-[60%] [&_pre]:text-foreground/70">
        <AsciiImage src={ownershipUi.image} />
        {/* The scrims fade the art into the ground at its left and bottom edges. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-background via-background/40 to-background/0"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-linear-to-r from-background via-background/30 to-background/0 md:block"
        />
      </div>
      <ChapterBreak number={number} title={title} credit={ownershipUi.image} />
    </div>
  );
}

/** The ownership part: a chapter break over the chess set, the layered graph of figure 12 across the page, then the text with a margin for its notes. */
export function OwnershipPart({ part }: { readonly part: ReportPart }) {
  const { figureTexts, parts, ownershipUi } = useContent();
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const body: ReactNode[] = [];
  part.blocks.forEach((block, index) => {
    // The blocks of a part never move, so their place is their identity.
    const key = `${part.slug}-${String(index)}`;
    if (block.kind === 'figure' && block.figure !== undefined) {
      body.push(
        <div key={key} className={cn(layout.bleed, 'my-16 md:my-24')}>
          <div className="mx-auto max-w-[1400px] px-4 md:px-8">
            <FigureFrame
              number={block.figure.number}
              title={block.figure.title}
              unit={block.figure.unit}
              period={block.figure.period}
              sources={block.figure.sources}
              note={figureTexts.figures['12'].note}
              partSlug={part.slug}
            >
              <OwnershipFigure />
            </FigureFrame>
            <FigureFrame
              title={ownershipUi.owners.title}
              unit={ownershipUi.owners.unit}
              sources={ownershipUi.owners.sources}
            >
              <OwnersMap />
            </FigureFrame>
          </div>
        </div>,
      );
      return;
    }
    if (block.kind === 'h3') {
      body.push(
        <div key={key} className={cn(ROW, 'mt-16')}>
          <h3 className={cn(PROSE, 'text-report-lead text-balance xl:col-start-2')}>
            {block.text}
          </h3>
        </div>,
      );
      return;
    }
    body.push(
      <div key={key} className={cn(ROW, block.kind === 'li' ? 'mt-10' : 'my-6')}>
        <div className="xl:col-start-2">
          <Reveal>
            <p className={cn(PROSE, block.kind === 'li' && 'border-t border-foreground pt-4')}>
              <RichText text={block.text} partSlug={part.slug} />
            </p>
          </Reveal>
        </div>
      </div>,
    );
  });
  return (
    <section id={part.slug} aria-label={part.title} className="scroll-mt-12">
      <Opening number={number} title={part.title} />
      <div className="py-16 md:py-24">{body}</div>
    </section>
  );
}
