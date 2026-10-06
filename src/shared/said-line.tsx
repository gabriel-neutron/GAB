import { cn } from '@/shared/lib/utils';

import type { Said } from './said';

interface SaidLineProps {
  /** Derived before it arrives. This file composes no sentence and takes no decision. */
  readonly said: Said;
  /** Several live regions stand on one page, and a reader needs to know which one spoke. */
  readonly label: string;
}

const LINE = 'block min-w-0 text-small/4';

/** The one live region of an act. A caller states what the act said; which role carries it, and
 * which hue, is decided here and in no other file. */
export function SaidLine({ said, label }: SaidLineProps) {
  return (
    <p
      role={said.urgent ? 'alert' : 'status'}
      aria-label={label}
      className={cn(LINE, said.urgent ? 'text-destructive' : 'text-label')}
    >
      {said.sentence}
    </p>
  );
}
