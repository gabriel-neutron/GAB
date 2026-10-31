import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { ChapterBreak } from '../primitives/chapter-break';

// The outline of display type: the stroke takes the ink, the fill stays empty.
export const OUTLINE = 'text-transparent [-webkit-text-stroke:1px_var(--color-foreground)]';

/** A typographic chapter break with a decorative fragment. Below
 * 1024px the fragment stacks under the numeral and the title, so nothing overlaps; from
 * 1024px up it sits on the empty right side, under the words of the break (`className` places it
 * there). */
export function ClosingBreak({
  number,
  title,
  art,
  className,
}: {
  readonly number: string;
  readonly title: string;
  readonly art: ReactNode;
  readonly className?: string;
}) {
  return (
    // Below 1024px the break takes the height of its content: no void between the numeral and
    // the title on a tall tablet.
    <div className="relative max-lg:[--report-view:auto]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-[calc(50%-50cqw)] w-[100cqw] overflow-hidden select-none max-lg:hidden"
      >
        <div className={cn('absolute', className)}>{art}</div>
      </div>
      <ChapterBreak number={number} title={title}>
        <div aria-hidden="true" className="pointer-events-none mt-12 select-none lg:hidden">
          {art}
        </div>
      </ChapterBreak>
    </div>
  );
}
