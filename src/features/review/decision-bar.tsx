import type { Decision } from '@gab/proposal/request';
import { useId, useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import type { WriteState } from '@/shared/write/write-state';

import { decisionWords } from './decision-words';
import { REJECTION_REASONS, rejectionGap } from './rejection';
import type { UnitWords } from './unit-changes';
import type { Unit } from './unit-page';

/** The decision that the screen stands in, and the unit it is about. */
export type DecisionState = WriteState<object, { readonly unitId: string }>;

/** What the operator did in the decision bar: send a decision, or stop aiming at one relation. */
export type DecisionAct =
  | { readonly kind: 'decide'; readonly unitId: string; readonly decision: Decision }
  | { readonly kind: 'aim'; readonly relationId: string | null };

export interface DecisionBarProps {
  readonly unit: Unit;
  readonly words: UnitWords;
  /** The one relation that Reject rejects alone, or null for the whole unit. */
  readonly aimed: string | null;
  readonly state: DecisionState;
  readonly onAct: (act: DecisionAct) => void;
}

const CHOOSER =
  'h-6 min-w-0 rounded-none border border-input bg-background px-1.5 text-xs text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50';

const sentenceOf = (state: DecisionState, unitId: string): string | null => {
  if (state.step === 'idle' || state.unitId !== unitId) return null;
  switch (state.step) {
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
 * before the click, and a rejection needs a reason. */
export function DecisionBar({ unit, words, aimed, state, onAct }: DecisionBarProps) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const ids = useId();
  const said = decisionWords(unit, words, aimed);
  const gap = rejectionGap(reason, note);
  const busy = state.step === 'working';
  const sentence = sentenceOf(state, unit.id);
  const written = note.trim() === '' ? {} : { note: note.trim() };

  const reject = (): void => {
    if (gap !== null) return;
    onAct({
      kind: 'decide',
      unitId: unit.id,
      decision:
        aimed === null
          ? { op: 'reject_unit', unitId: unit.id, reason, ...written }
          : { op: 'reject_relation', proposalId: aimed, reason, ...written },
    });
  };

  return (
    <section
      aria-label="The decision"
      className="shrink-0 space-y-2 border-t border-border p-3 text-xs"
    >
      {aimed === null ? (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1" data-said="promote">
            {said.promote}
          </p>
          <Button
            type="button"
            size="xs"
            disabled={busy}
            onClick={() => {
              onAct({
                kind: 'decide',
                unitId: unit.id,
                decision: { op: 'promote_unit', unitId: unit.id },
              });
            }}
          >
            Promote
          </Button>
        </div>
      ) : null}

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
          onClick={reject}
        >
          {aimed === null ? 'Reject' : 'Reject the relation'}
        </Button>
        {aimed === null ? null : (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              onAct({ kind: 'aim', relationId: null });
            }}
          >
            Back to the unit
          </Button>
        )}
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
