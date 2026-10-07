import { Check, X } from 'lucide-react';
import { useId, useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

import type { ChangeKind, Decision, Verdict } from './queue';
import { VERDICT_WORDS } from './queue';
import { VerdictMark } from './verdict-mark';

export interface DecideProps {
  /** What the act does to the row, or a linked batch that the controls decide as one unit. It
   * says whether the record can take a promotion of it. */
  readonly kind: ChangeKind | 'batch';
  /** `null` while the act or the batch waits. */
  readonly decision: Decision | null;
  /** One act reaches the record at a time. A second click sends a second decision on a row the
   * first one has already moved. */
  readonly busy: boolean;
  readonly onDecide: (verdict: Verdict) => void;
}

/** Where the controls stand: at rest, or asking once before a verdict goes to the record. */
type Stance = { readonly kind: 'resting' } | { readonly kind: 'asking'; readonly verdict: Verdict };

const RESTING: Stance = { kind: 'resting' };

// The kit writes `transition-all` at the Tailwind default of 150ms, and the theme allows 120.
const KIT = 'duration-100';

const ROW = 'flex items-center gap-2';

const QUESTION = 'min-w-0 flex-1 truncate text-small/4 text-destructive';

const NOTE = 'shrink-0 text-small/4 text-label';

const QUESTIONS: Readonly<Record<Verdict, string>> = {
  promoted: 'Promote this act? It writes the row, and no door takes it back.',
  rejected: 'Reject this act? A rejected act is frozen, and it never waits again.',
};

const BATCH_QUESTIONS: Readonly<Record<Verdict, string>> = {
  promoted:
    'Promote every act of this batch? It writes all rows or none, and no door takes it back.',
  rejected: 'Reject every act of this batch? A rejected act is frozen, and it never waits again.',
};

// External constraint: the record refuses a merge at promotion, because a merge has no write
// path yet. The lookup is total, so a new kind states whether the record takes it.
const NO_PROMOTION: Readonly<Record<ChangeKind | 'batch', string | null>> = {
  add: null,
  edit: null,
  delete: null,
  merge: 'A merge has no write path yet.',
  map: null,
  batch: null,
};

const CONFIRM: Readonly<Record<Verdict, string>> = {
  promoted: 'Promote it',
  rejected: 'Reject it',
};

/** A verdict is written the moment it is taken, and the record has no door back. So this screen
 * asks once before it sends. */
export function Decide({ kind, decision, busy, onDecide }: DecideProps) {
  const refused = useId();
  const [stance, setStance] = useState<Stance>(RESTING);

  if (decision !== null) {
    const words = VERDICT_WORDS[decision.verdict];
    return (
      <div className={ROW}>
        <VerdictMark verdict={decision.verdict} words={words} />
        <span className="shrink-0 text-xs text-foreground">{words}</span>
      </div>
    );
  }

  if (stance.kind === 'asking') {
    return (
      <div className={ROW}>
        {/* The question is asked where the hand already is, and the hand may have left it. A
            reader meets the question because it interrupts, and never because it looks. */}
        <span role="alert" className={QUESTION}>
          {(kind === 'batch' ? BATCH_QUESTIONS : QUESTIONS)[stance.verdict]}
        </span>
        <Button
          // This control gets a node of its own, so the press that asked never lands on the answer
          // that writes the row.
          key="confirm"
          variant={stance.verdict === 'rejected' ? 'destructive' : 'default'}
          size="xs"
          className={KIT}
          disabled={busy}
          onClick={(event) => {
            // The browser counts the presses of one sequence, and it carries the count over to
            // the control that takes the place of the one that was pressed. A press above one
            // opened this question, so it never answers it.
            if (event.detail > 1) return;
            setStance(RESTING);
            onDecide(stance.verdict);
          }}
        >
          {CONFIRM[stance.verdict]}
        </Button>
        <Button
          // The control that keeps the act waiting takes the node of `Promote`, so the hand stays
          // on it, whatever the merge note does to the positions.
          key="stay"
          variant="outline"
          size="xs"
          className={KIT}
          onClick={() => {
            setStance(RESTING);
          }}
        >
          Keep it waiting
        </Button>
      </div>
    );
  }

  const noPromotion = NO_PROMOTION[kind];
  return (
    <div className="flex items-center justify-end gap-1">
      {/* The two acts are parted, because they are 4px apart and both final. */}
      <Button
        variant="destructive"
        size="xs"
        className={cn(KIT, 'mr-4')}
        disabled={busy}
        onClick={() => {
          setStance({ kind: 'asking', verdict: 'rejected' });
        }}
      >
        <X aria-hidden="true" />
        Reject
      </Button>
      {noPromotion === null ? null : (
        <span id={refused} className={NOTE}>
          {noPromotion}
        </span>
      )}
      <Button
        // The control that keeps the act waiting takes this node when the question opens.
        key="stay"
        size="xs"
        className={KIT}
        disabled={busy || noPromotion !== null}
        aria-describedby={noPromotion === null ? undefined : refused}
        onClick={() => {
          setStance({ kind: 'asking', verdict: 'promoted' });
        }}
      >
        <Check aria-hidden="true" />
        Promote
      </Button>
    </div>
  );
}
