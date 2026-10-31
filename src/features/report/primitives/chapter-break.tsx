import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { ScrambleText } from '../scramble-text';
import { AsciiImage } from './ascii-image';
import { layout } from './layout';
import { Reveal } from './reveal';

/** The head of every chapter: on a phone the numeral and the title in one row, on a wider screen
 * the numeral over the title. The summary uses it without the break, so all chapters match. The
 * numeral uses the display face: its plain zero reads as a figure; the mono zero carries a slash. */
export const chapterHead = {
  row: 'flex items-end gap-4 md:block',
  number:
    'shrink-0 text-report-display leading-[0.78] tracking-[-0.06em] text-foreground/90 tabular-nums ',
  title: 'min-w-0 text-report-heading leading-[0.95] tracking-[-0.045em] text-balance md:mt-6',
} as const;

interface ChapterBreakImage {
  readonly src: string;
  readonly alt: string;
  /** The credit line of public/report-media/credits.json. */
  readonly credit: string;
  /** "Illustration. Not evidence of the investigation." */
  readonly label: string;
}

interface ChapterBreakProps {
  /** The part number as it shows, for example "04". */
  readonly number: string;
  readonly title: string;
  /** One sentence quoted verbatim from the text of the part. */
  readonly quote?: string | undefined;
  /** Art for an ASCII background. It always shows its label and credit. */
  readonly image?: ChapterBreakImage | undefined;
  readonly children?: ReactNode;
}

/** The full-width opening of a part: a giant numeral, the part title as the h2 of the part,
 * one quoted sentence, and an optional ASCII background with its credit. Put it first in the part
 * section. The head sits at the foot of the break, with or without art. */
export function ChapterBreak({ number, title, quote, image, children }: ChapterBreakProps) {
  return (
    <div
      className={cn(
        layout.bleed,
        'isolate flex min-h-[60svh] flex-col justify-end overflow-hidden border-b border-border md:min-h-[var(--report-view,100svh)]',
      )}
    >
      {image === undefined ? null : (
        <>
          <AsciiImage src={image.src} alt={image.alt} />
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
        {quote === undefined ? null : (
          <Reveal>
            <p className="mt-8 max-w-[40ch] border-l border-foreground pl-4 text-report-lead leading-snug tracking-[-0.02em] text-balance text-foreground/75">
              {quote}
            </p>
          </Reveal>
        )}
        {children}
      </div>
      {image === undefined ? null : (
        // On a phone the credit is a caption under the words, so it never covers the numeral.
        <p className="relative mx-4 mb-6 self-start border border-border bg-background px-2 py-1 font-mono text-report-label/4 text-label md:absolute md:top-3 md:right-4 md:m-0 md:max-w-[44ch] md:text-right">
          <span className="block text-foreground">{image.label}</span>
          {image.credit}
        </p>
      )}
    </div>
  );
}
