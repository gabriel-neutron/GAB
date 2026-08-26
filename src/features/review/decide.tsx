import { Check, Clock, Undo2, X } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

import type { Decision, Verdict } from './queue';
import { VERDICT_WORDS } from './queue';
import { VerdictMark } from './verdict-mark';

export interface DecideProps {
  /** `null` while the act waits. The three controls act on one act, and never on a group. */
  readonly decision: Decision | null;
  readonly onDecide: (verdict: Verdict, reason: string) => void;
  readonly onUndo: () => void;
}

// The kit writes `transition-all` at the Tailwind default of 150ms, and the theme allows 120.
const KIT = 'duration-100';

/** The promotion is not reversible in the record, so this screen must never be the first place a
 * person learns that a keystroke was final: a verdict of the pass is taken back while it lasts. */
export function Decide({ decision, onDecide, onUndo }: DecideProps) {
  const [reason, setReason] = useState('');
  const [holding, setHolding] = useState(false);

  if (decision !== null) {
    const words = VERDICT_WORDS[decision.verdict];
    return (
      <div className="flex items-center gap-2">
        <VerdictMark verdict={decision.verdict} words={words} />
        <span className="shrink-0 text-xs text-foreground">{words}</span>
        {/* The reason was asked for, so it is drawn. A field that is collected and dropped is
            a field that should not have been asked for. */}
        {decision.reason === '' ? null : (
          <span className="min-w-0 flex-1 truncate text-xs text-label" title={decision.reason}>
            {decision.reason}
          </span>
        )}
        <Button variant="outline" size="xs" className={cn(KIT, 'ml-auto')} onClick={onUndo}>
          <Undo2 aria-hidden="true" />
          Undo
        </Button>
      </div>
    );
  }

  if (holding) {
    return (
      <div className="flex items-center gap-2">
        <label htmlFor="review-hold-reason" className="shrink-0 text-xs text-label">
          Why not yet
        </label>
        <input
          id="review-hold-reason"
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          className={cn(
            'h-6 min-w-0 flex-1 border border-input bg-background px-1.5 text-xs',
            'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
          )}
        />
        <Button
          variant="outline"
          size="xs"
          className={KIT}
          onClick={() => {
            onDecide('deferred', reason);
            setHolding(false);
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
            setHolding(false);
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
        onClick={() => {
          setHolding(true);
        }}
      >
        <Clock aria-hidden="true" />
        Not yet
      </Button>
      <Button
        variant="destructive"
        size="xs"
        className={cn(KIT, 'mr-4')}
        onClick={() => {
          onDecide('rejected', '');
        }}
      >
        <X aria-hidden="true" />
        Reject
      </Button>
      <Button
        size="xs"
        className={KIT}
        onClick={() => {
          onDecide('promoted', '');
        }}
      >
        <Check aria-hidden="true" />
        Promote
      </Button>
    </div>
  );
}
