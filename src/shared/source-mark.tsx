import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

export interface SourceMarkProps {
  /** What the badge shows: a position on one surface, a rating on the other. */
  readonly label: ReactNode;
  /** The accessible name. The badge is small, so the whole line reaches a reader here. */
  readonly name: string;
  /** The panel. The caller owns it, because two surfaces hold two different cards. */
  readonly children: ReactNode;
  /** What the badge stands for, in one word, where the hue also says it. A check reads this. */
  readonly band?: string | undefined;
  readonly className?: string | undefined;
}

/** `border-input` measures 3.4:1 light and 3.2:1 dark on a control edge, and `border-border`
 * 1.3:1. `h-6` is the row and the control of the density block. */
const MARK = cn(
  'inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-none border px-1',
  'border-input font-mono text-small/4 text-label transition-colors duration-100',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

export function SourceMark({ label, name, children, band, className }: SourceMarkProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={name}
        title={name}
        data-band={band}
        className={cn(MARK, className)}
      >
        {label}
      </PopoverTrigger>
      {/* The kit writes `w-72 rounded-lg p-4` at its own scale, and a vendored file is closed,
          so the correction is made here. */}
      <PopoverContent align="start" className="w-80 space-y-1 rounded-none p-2">
        {children}
      </PopoverContent>
    </Popover>
  );
}
