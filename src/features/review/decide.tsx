import { Check, Clock, Undo2, X } from 'lucide-react';
import { useId, useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

import type { Decision, Verdict } from './queue';
import { VERDICT_WORDS } from './queue';
import { VerdictMark } from './verdict-mark';

export interface DecideProps {
  /** `null` while the act waits. The three controls act on one act, and never on a group. */
  readonly decision: Decision | null;
  /** One act reaches the record at a time. A second click sends a second decision on a row the
   * first one has already moved. */
  readonly busy: boolean;
  readonly onDecide: (verdict: Verdict, reason: string) => void;
  readonly onUndo: () => void;
}

/** Where the controls stand. A question and a hold cannot both be open, so one value holds both
 * and the pair of states that reads "asking to promote while holding" cannot be built. */
type Stance =
  | { readonly kind: 'resting' }
  | { readonly kind: 'holding' }
  | { readonly kind: 'asking'; readonly verdict: 'promoted' | 'rejected' };

const RESTING: Stance = { kind: 'resting' };

// The kit writes `transition-all` at the Tailwind default of 150ms, and the theme allows 120.
const KIT = 'duration-100';

const ROW = 'flex items-center gap-2';

const QUESTION = 'min-w-0 flex-1 truncate text-small/4 text-destructive';

const NOTE = 'shrink-0 text-small/4 text-label';

/** A hold that carries no words tells the next reader nothing. So the control waits for words,
 * and the screen says what it waits for. Spaces alone are not words. */
const BLANK_HOLD = 'A hold takes a written reason.';

const QUESTIONS: Readonly<Record<'promoted' | 'rejected', string>> = {
  promoted: 'Promote this act? It writes the row, and no door takes it back.',
  rejected: 'Reject this act? A rejected act is frozen, and it never waits again.',
};

const CONFIRM: Readonly<Record<'promoted' | 'rejected', string>> = {
  promoted: 'Promote it',
  rejected: 'Reject it',
};

/** A promotion is written the moment it is taken, and the record has no door back. So this
 * screen asks once before it sends, and it offers the way back only where one exists. */
export function Decide({ decision, busy, onDecide, onUndo }: DecideProps) {
  const said = useId();
  const [reason, setReason] = useState('');
  const [stance, setStance] = useState<Stance>(RESTING);

  if (decision !== null) {
    const words = VERDICT_WORDS[decision.verdict];
    return (
      <div className={ROW}>
        <VerdictMark verdict={decision.verdict} words={words} />
        <span className="shrink-0 text-xs text-foreground">{words}</span>
        {/* The reason was asked for, so it is drawn. A field that is collected and dropped is
            a field that should not have been asked for. */}
        {decision.reason === '' ? null : (
          <span className="min-w-0 flex-1 truncate text-xs text-label" title={decision.reason}>
            {decision.reason}
          </span>
        )}
        {/* Only a hold is taken back. The other two stand in the record, and a control that
            offered to undo one would state a door that the record does not hold. */}
        {decision.verdict === 'deferred' ? (
          <Button variant="outline" size="xs" className={cn(KIT, 'ml-auto')} onClick={onUndo}>
            <Undo2 aria-hidden="true" />
            Undo
          </Button>
        ) : null}
      </div>
    );
  }

  if (stance.kind === 'asking') {
    return (
      <div className={ROW}>
        {/* The question is asked where the hand already is, and the hand may have left it. A
            reader meets the question because it interrupts, and never because it looks. */}
        <span role="alert" className={QUESTION}>
          {QUESTIONS[stance.verdict]}
        </span>
        <Button
          // This control stands where `Reject` stood, and both are a button, so the node would
          // be kept and the press that asked would land on `Reject it`. Only this one is keyed:
          // a key on the row would drop the hand on all three paths.
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
            onDecide(stance.verdict, '');
          }}
        >
          {CONFIRM[stance.verdict]}
        </Button>
        <Button
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

  if (stance.kind === 'holding') {
    const blank = reason.trim() === '';
    return (
      <div className={ROW}>
        <label htmlFor="review-hold-reason" className="shrink-0 text-xs text-label">
          Why not yet
        </label>
        <input
          id="review-hold-reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          // The note states the rule the box waits for, so it is the description of the box. It
          // carries no `aria-invalid`: an empty box is not a box that holds a refused value.
          aria-describedby={blank ? said : undefined}
          className={cn(
            'h-6 min-w-0 flex-1 border border-input bg-background px-1.5 text-xs',
            'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          )}
        />
        {blank ? (
          <span id={said} className={NOTE}>
            {BLANK_HOLD}
          </span>
        ) : null}
        <Button
          variant="outline"
          size="xs"
          className={KIT}
          disabled={blank}
          onClick={() => {
            onDecide('deferred', reason);
            setStance(RESTING);
            setReason('');
          }}
        >
          Hold
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className={KIT}
          onClick={() => {
            setStance(RESTING);
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {/* A hold is a state of this pass and never a row of the record. It sits away from the
          two costly acts, and those two are parted, because they are 4px apart and both final. */}
      <Button
        variant="ghost"
        size="xs"
        className={cn(KIT, 'mr-auto')}
        disabled={busy}
        onClick={() => {
          setStance({ kind: 'holding' });
        }}
      >
        <Clock aria-hidden="true" />
        Not yet
      </Button>
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
      <Button
        size="xs"
        className={KIT}
        disabled={busy}
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
