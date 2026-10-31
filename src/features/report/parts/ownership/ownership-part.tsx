import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { figureTexts, ownershipUi, parts, ui, type ReportPart } from '../../content';
import { FigureFrame } from '../../figure-frame';
import { AsciiImage } from '../../primitives/ascii-image';
import { BigNumber } from '../../primitives/big-number';
import { ChapterBreak } from '../../primitives/chapter-break';
import { layout } from '../../primitives/layout';
import { Reveal } from '../../primitives/reveal';
import { RichText } from '../../rich-text';
import { OwnershipFigure } from './ownership-figure';

// One body size for all the text of the part. A node reference keeps a thin dotted underline.
const PROSE =
  'max-w-[64ch] text-[18px]/[1.65] text-pretty md:text-[20px]/[1.65] [&_button]:decoration-dotted';
// From 1024px, a rail at the left of the text holds the notes of each paragraph.
const ROW = 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,64ch)] lg:gap-x-16';

/** The notes of one paragraph, in the rail: a reader sees the source beside the claim. The note
 * markers in the text stay the way in for assistive technology, so the rail is hidden from it. */
function Rail({ text, part }: { readonly text: string; readonly part: ReportPart }) {
  const ids = [...text.matchAll(/\[\^([^\]]+)\]/g)].map((match) => match[1] ?? '');
  const notes = part.notes.filter((note) => ids.includes(note.id));
  return (
    <aside aria-hidden="true" className="hidden pt-2 lg:block">
      <ol className="ml-auto max-w-[40ch] space-y-3 border-t border-divider pt-3">
        {notes.map((note) => (
          <li key={note.id} className="flex gap-3 text-small/5 text-muted-foreground">
            <span className="w-6 shrink-0 font-mono text-label tabular-nums">
              {note.id.slice(note.id.lastIndexOf('-') + 1)}
            </span>
            <span className="line-clamp-3 min-w-0 break-words">
              <RichText text={note.text} />
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

/** The chapter break over the chess set: the ASCII art sits at the top right, behind a scrim, so
 * the title stays on near-black ground, and the credit sits at the top right of the art. */
function Opening({ number, title }: { readonly number: string; readonly title: string }) {
  const { image } = ownershipUi;
  const credit = (
    <>
      <span className="block tracking-[0.08em] text-foreground uppercase">{ui.cover.label}</span>
      {image.credit}
    </>
  );
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
        <AsciiImage src={image.src} alt={image.alt} />
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
      <ChapterBreak number={number} title={title} quote={ownershipUi.quote}>
        {/* On a phone, the credit goes under the quote, clear of the numeral. */}
        <p className="mt-8 font-mono text-small/4 text-label md:hidden">{credit}</p>
      </ChapterBreak>
      {/* From 768px, the credit sits at the top right of the art, inside the first view. */}
      <p className="absolute top-4 right-8 hidden max-w-[34ch] lg:max-w-[52ch] border border-border bg-background px-2 py-1 text-right font-mono text-small/4 text-label md:block">
        {credit}
      </p>
    </div>
  );
}

/** The ownership part: a chapter break over the chess set, the two ownership rules side by side,
 * the layered graph of figure 12 across the page, then the text with its notes in a rail. */
export function OwnershipPart({ part }: { readonly part: ReportPart }) {
  const number = String(parts.indexOf(part) + 1).padStart(2, '0');
  const body: ReactNode[] = [];
  part.blocks.forEach((block, index) => {
    // The blocks of a part never move, so their place is their identity.
    const key = `${part.slug}-${String(index)}`;
    if (block.kind === 'figure' && block.figure !== undefined) {
      body.push(
        <div key={key} className={cn(layout.bleed, 'my-16 md:my-24')}>
          {/* The figure gives no unit and no period: their empty fields stay out of view. */}
          <div className="mx-auto max-w-[1400px] px-4 md:px-8 [&_dl>div:has(>dd:empty)]:hidden">
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
          </div>
        </div>,
      );
      return;
    }
    body.push(
      <div key={key} className={cn(ROW, block.kind === 'li' ? 'mt-10' : 'my-6')}>
        <Rail text={block.text} part={part} />
        <Reveal>
          <p className={cn(PROSE, block.kind === 'li' && 'border-t border-foreground pt-4')}>
            <RichText text={block.text} partSlug={part.slug} />
          </p>
        </Reveal>
      </div>,
    );
    if (index === 0)
      body.push(
        <div
          key="rules"
          className="mt-14 grid gap-12 border-t border-border pt-10 md:grid-cols-2 md:gap-16"
        >
          {[ownershipUi.rule, ownershipUi.ruleEu].map((rule) => (
            <BigNumber
              key={rule.note}
              value={rule.value}
              label={rule.label}
              note={{ partSlug: part.slug, id: rule.note }}
            />
          ))}
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
