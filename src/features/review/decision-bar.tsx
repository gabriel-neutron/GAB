import { useId, useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { WriteState } from '@/shared/write/write-state';

import type { DecisionWords } from './decision-words';
import { REJECTION_REASONS, rejectionGap } from './rejection';

/** The decision that the screen stands in, and the unit it is about. */
export type DecisionState = WriteState<object, { readonly unitId: string }>;

/** What the operator did in the decision bar: promote, reject with a reason, or stop aiming at
 * one relation. */
export type BarAct =
  | { readonly kind: 'promote' }
  | { readonly kind: 'reject'; readonly reason: string; readonly note?: string }
  | { readonly kind: 'unaim' };

export interface DecisionBarProps {
  /** What Promote writes and what Reject rejects, for the unit on the screen. */
  readonly said: DecisionWords;
  /** True when Reject rejects one relation alone, and not the whole unit. */
  readonly aimed: boolean;
  /** The decision on this unit. Idle when the screen decides no other act on it. */
  readonly state: DecisionState;
  readonly onAct: (act: BarAct) => void;
}

const CHOOSER =
  'h-6 min-w-0 rounded-none border border-input bg-background px-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50';

const sentenceOf = (state: DecisionState): string | null => {
  switch (state.step) {
    case 'idle':
      return null;
    case 'working':
      return 'The decision is on the way to the record.';
    case 'done':
      return 'The record holds the decision.';
    case 'refused':
      return `Nothing was written: ${state.refusal}`;
    case 'unknown':
      return `${state.doubt} Open this page again before the next decision.`;
  }
};

/** Promote or reject the unit, or reject one relation of it. Each control says what it does
 * before the click, and a rejection needs a reason. Promote is off on a blocked unit, and the
 * sentence says why. */
export function DecisionBar({ said, aimed, state, onAct }: DecisionBarProps) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const ids = useId();
  const gap = rejectionGap(reason, note);
  const busy = state.step === 'working';
  const sentence = sentenceOf(state);

  return (
    <section
      aria-label="The decision"
      className="shrink-0 space-y-2 border-t border-border p-3 text-xs"
    >
      {aimed ? null : (
        <div className="flex items-start gap-2">
          <p
            className={cn('min-w-0 flex-1', said.promote.kind === 'blocked' && 'text-destructive')}
            data-said="promote"
          >
            {said.promote.said}
          </p>
          <Button
            type="button"
            size="xs"
            disabled={busy || said.promote.kind === 'blocked'}
            onClick={() => {
              onAct({ kind: 'promote' });
            }}
          >
            Promote
          </Button>
        </div>
      )}

      <p data-said="reject">{said.reject}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${ids}-reason`} className="text-label">
          Reason
        </label>
        <select
          id={`${ids}-reason`}
          className={CHOOSER}
          value={reason}
          disabled={busy}
          onChange={(event) => {
            setReason(event.target.value);
          }}
        >
          <option value="">Choose a reason</option>
          {REJECTION_REASONS.map((held) => (
            <option key={held.key} value={held.key}>
              {held.words}
            </option>
          ))}
        </select>
        <label htmlFor={`${ids}-note`} className="sr-only">
          Note
        </label>
        <Input
          id={`${ids}-note`}
          className="h-6 min-w-40 flex-1 rounded-none px-1.5 py-0 text-xs md:text-xs"
          placeholder={reason === 'other' ? 'Note: why (required)' : 'Note (optional)'}
          value={note}
          disabled={busy}
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
        <Button
          type="button"
          size="xs"
          variant="destructive"
          disabled={busy || gap !== null}
          onClick={() => {
            if (gap === null)
              onAct({
                kind: 'reject',
                reason,
                ...(note.trim() === '' ? {} : { note: note.trim() }),
              });
          }}
        >
          {aimed ? 'Reject the relation' : 'Reject'}
        </Button>
        {aimed ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              onAct({ kind: 'unaim' });
            }}
          >
            Back to the unit
          </Button>
        ) : null}
      </div>
      {gap === null || reason === '' ? null : <p className="text-label">{gap}</p>}
      {sentence === null ? null : (
        <p
          role="status"
          className={cn(
            state.step === 'refused' || state.step === 'unknown'
              ? 'text-destructive'
              : 'text-label',
          )}
        >
          {sentence}
        </p>
      )}
    </section>
  );
}
