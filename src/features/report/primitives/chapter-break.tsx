import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { ImageCredit } from '../note-ref';
import { ScrambleText } from '../scramble-text';
import { useContent } from '../use-content';
import { AsciiImage } from './ascii-image';
import { layout } from './layout';

/** The head of every chapter: on a phone the numeral and the title in one row, on a wider screen
 * the numeral over the title. The summary uses it without the break, so all chapters match. The
 * numeral uses the display face: its plain zero reads as a figure; the mono zero carries a slash. */
export const chapterHead = {
  row: 'flex items-end gap-4 md:block',
  number:
    'shrink-0 text-report-display leading-[0.78] tracking-[-0.06em] text-foreground/90 tabular-nums ',
  title: 'min-w-0 text-report-heading leading-[0.95] tracking-[-0.045em] text-balance md:mt-6',
} as const;

interface ChapterBreakProps {
  /** The part number as it shows, for example "04". */
  readonly number: string;
  readonly title: string;
  /** The source of a decorative ASCII background. */
  readonly image?: string | undefined;
  /** The source of art that the part draws outside the break, for its credit. */
  readonly credit?: string | undefined;
  readonly children?: ReactNode;
}

/** The full-width opening of a part: a giant numeral, the part title as the h2 of the part, and
 * an optional decorative ASCII background with its credit marker. Put it first in the part
 * section. The head sits at the foot of the break, with or without art. */
export function ChapterBreak({ number, title, image, credit, children }: ChapterBreakProps) {
  const { ui } = useContent();
  const art = credit ?? image;
  return (
    <div
      className={cn(
        layout.bleed,
        'isolate flex min-h-[40svh] flex-col justify-end overflow-hidden border-b border-border md:min-h-[var(--report-view,100svh)]',
      )}
    >
      {image === undefined ? null : (
        <>
          <AsciiImage src={image} />
          {/* The scrim keeps the words clear of the art. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-linear-to-t from-background via-background/70 to-background/10"
          />
        </>
      )}
      <div
        className={cn(
          'relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-end px-4 pb-12 md:px-8 md:pb-20',
          image === undefined ? 'pt-8 md:pt-12' : 'pt-12 md:pt-24',
        )}
      >
        <div className={chapterHead.row}>
          <p aria-hidden="true" className={chapterHead.number}>
            {number}
          </p>
          <h2 className={cn(chapterHead.title, 'max-w-[16ch]')}>
            <ScrambleText text={title} />
          </h2>
        </div>
        {art === undefined ? null : (
          <p className="mt-4 w-fit font-mono text-report-label uppercase text-label">
            {ui.note.image}
            <ImageCredit src={art} />
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
