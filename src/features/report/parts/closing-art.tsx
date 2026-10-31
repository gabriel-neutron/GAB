import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { ui } from '../content';
import { ChapterBreak } from '../primitives/chapter-break';

// The outline of display type: the stroke takes the ink, the fill stays empty.
export const OUTLINE = 'text-transparent [-webkit-text-stroke:1px_var(--color-foreground)]';

// The art is decoration, so it always carries the standard label.
const Label = ({ className }: { readonly className?: string | undefined }) => (
  <p
    className={cn(
      'mt-3 font-mono text-report-label/4 tracking-[0.08em] text-label uppercase ',
      className,
    )}
  >
    {ui.cover.label}
  </p>
);

/** A typographic chapter break with a decorative fragment and its illustration label. Below
 * 1024px the fragment stacks under the numeral, the title and the quote, so nothing overlaps; from
 * 1024px up it sits on the empty right side, under the words of the break (`className` places it
 * there). */
export function ClosingBreak({
  number,
  title,
  quote,
  art,
  className,
  labelClassName,
}: {
  readonly number: string;
  readonly title: string;
  readonly quote: string;
  readonly art: ReactNode;
  readonly className?: string;
  /** Moves the label of the wide layout, for art that bleeds off the page. */
  readonly labelClassName?: string;
}) {
  return (
    // Below 1024px the break takes the height of its content: no void between the numeral and
    // the title on a tall tablet.
    <div className="relative max-lg:[--report-view:auto]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[calc(50%-50cqw)] w-[100cqw] overflow-hidden select-none max-lg:hidden"
      >
        <div className={cn('absolute', className)}>
          {art}
          <Label className={labelClassName} />
        </div>
      </div>
      <ChapterBreak number={number} title={title} quote={quote}>
        <div aria-hidden="true" className="pointer-events-none mt-12 select-none lg:hidden">
          {art}
          <Label />
        </div>
      </ChapterBreak>
    </div>
  );
}
