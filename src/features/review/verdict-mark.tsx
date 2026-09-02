import { Check, Clock, X } from 'lucide-react';

import { cn } from '@/shared/lib/utils';

import type { Verdict } from './queue';

export interface VerdictMarkProps {
  readonly verdict: Verdict;
  /** For a pointer. The caller draws the same words for a reader, seen or unseen, because only
   * the caller knows whether its line has room for them. */
  readonly words: string;
}

const GLYPH: Readonly<Record<Verdict, typeof Check>> = {
  promoted: Check,
  rejected: X,
  deferred: Clock,
};

const PAINT: Readonly<Record<Verdict, string>> = {
  promoted: 'text-primary',
  rejected: 'text-dissent',
  deferred: 'text-label',
};

/** What this pass decided of one act. The foot of the page and the line of a list draw the same
 * mark, so a reader learns one shape for a verdict and not two. */
export function VerdictMark({ verdict, words }: VerdictMarkProps) {
  const Glyph = GLYPH[verdict];
  return (
    <span data-verdict={verdict} title={words} className={cn('shrink-0', PAINT[verdict])}>
      <Glyph size={14} aria-hidden="true" />
    </span>
  );
}
