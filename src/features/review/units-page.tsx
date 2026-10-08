import type { Decision } from '@gab/proposal/request';
import { useState } from 'react';

import { ChangeList, type RelationAct } from './change-list';
import { DecisionBar, type BarAct, type DecisionState } from './decision-bar';
import { decisionDone } from './decision-done';
import { decisionWords } from './decision-words';
import { Justification } from './justification';
import { QueueFilterBar } from './queue-filter';
import type { QueueFilter } from './review-workspace';
import type { UnitWords } from './unit-changes';
import { UnitList, type UnitListAct, type UnitQueue } from './unit-list';
import type { FilterChoices, Unit } from './unit-page';

/** The unit that the address names when the pages read so far do not hold it: none asked, the
 * unit read by its identifier, or a unit that waits no more. */
export type LinkedUnit =
  | { readonly state: 'none' }
  | { readonly state: 'held'; readonly unit: Unit }
  | { readonly state: 'gone'; readonly unitId: string };

/** The queue as this page holds it, with the filter that keeps it, the choices of the filter, the
 * unit of the address and the decision that it stands in, or the sentence that says why it holds
 * none. */
export type QueueView =
  | {
      readonly state: 'held';
      readonly queue: UnitQueue;
      readonly filter: QueueFilter;
      readonly choices: FilterChoices;
      readonly linked: LinkedUnit;
      readonly decision: DecisionState;
    }
  | { readonly state: 'private'; readonly why: string };

/** What the operator did on the page: open a unit, read the next page, read from the first unit,
 * change the filter, or decide one unit. A decision carries the line that says what it did, for
 * the screen after the record took it. */
export type ReviewAct =
  | UnitListAct
  | { readonly kind: 'filter'; readonly filter: QueueFilter }
  | {
      readonly kind: 'decide';
      readonly unitId: string;
      readonly decision: Decision;
      readonly said: string;
    };

export interface UnitsPageProps {
  readonly view: QueueView;
  /** The unit under examination. An empty identifier, or one that the page does not know, opens
   * the first unit. A unit that waits no more opens no unit. */
  readonly selectedId: string;
  readonly words: UnitWords;
  readonly onAct: (act: ReviewAct) => void;
}

/** The relation that Reject aims at, and the unit it belongs to. */
interface Aim {
  readonly unitId: string;
  readonly relationId: string;
}

const IDLE: DecisionState = { step: 'idle' };

/** The review queue in three columns: the units, the changes of one unit with its decision, and
 * why it waits. Each column scrolls on its own, so the page itself never scrolls under the
 * lists. */
export function UnitsPage({ view, selectedId, words, onAct }: UnitsPageProps) {
  // The aim dies with the view: a reload aims at the whole unit again.
  const [aim, setAim] = useState<Aim | null>(null);
  if (view.state === 'private') return <p className="p-3 text-xs text-label">{view.why}</p>;
  const { units } = view.queue;
  const { linked } = view;
  const gone = linked.state === 'gone' && linked.unitId === selectedId;
  // Promote and Reject act on this unit, the one that the screen shows.
  const unit =
    units.find((held) => held.id === selectedId) ??
    (linked.state === 'held' && linked.unit.id === selectedId ? linked.unit : null) ??
    (gone ? null : (units[0] ?? null));
  const aimed =
    unit !== null &&
    aim !== null &&
    aim.unitId === unit.id &&
    unit.acts.some((act) => act.id === aim.relationId)
      ? aim.relationId
      : null;

  const decide = (shown: Unit, decision: Decision): void => {
    onAct({
      kind: 'decide',
      unitId: shown.id,
      decision,
      said: decisionDone(shown, words, decision),
    });
  };

  const onBar = (act: BarAct): void => {
    if (unit === null) return;
    switch (act.kind) {
      case 'unaim':
        setAim(null);
        return;
      case 'promote':
        decide(unit, { op: 'promote_unit', unitId: unit.id });
        return;
      case 'reject': {
        const { reason, note } = act;
        const written = note === undefined ? {} : { note };
        decide(
          unit,
          aimed === null
            ? { op: 'reject_unit', unitId: unit.id, reason, ...written }
            : { op: 'reject_relation', proposalId: aimed, reason, ...written },
        );
        return;
      }
    }
  };

  // A relation whose other end was rejected is rejected at once, with the reason that says so. A
  // relation that is its whole unit goes with its unit.
  const onRelation = (act: RelationAct): void => {
    if (unit === null) return;
    if (act.kind === 'aim') {
      setAim({ unitId: unit.id, relationId: act.relationId });
      return;
    }
    decide(
      unit,
      act.relationId === unit.id
        ? { op: 'reject_unit', unitId: unit.id, reason: 'end_rejected' }
        : { op: 'reject_relation', proposalId: act.relationId, reason: 'end_rejected' },
    );
  };

  return (
    <div
      data-units-page
      className="grid h-full min-h-0 grid-cols-[clamp(16rem,26%,22rem)_minmax(0,1fr)_clamp(15rem,28%,26rem)] overflow-hidden"
    >
      <div className="flex min-h-0 flex-col border-r border-border">
        <QueueFilterBar
          filter={view.filter}
          choices={view.choices}
          onFilter={(filter) => {
            onAct({ kind: 'filter', filter });
          }}
        />
        <UnitList queue={view.queue} selectedId={unit?.id ?? null} words={words} onAct={onAct} />
      </div>
      <div className="flex min-h-0 flex-col">
        {view.decision.step === 'done' ? (
          <p
            role="status"
            data-said="done"
            className="shrink-0 border-b border-border px-3 py-1 text-xs text-label"
          >
            {view.decision.said}
          </p>
        ) : null}
        {gone ? (
          <p data-said="gone" className="p-3 text-xs">
            This unit is not in the queue. It was decided, or the address names no unit. Choose a
            unit on the left.
          </p>
        ) : (
          <ChangeList unit={unit} words={words} aimed={aimed} onRelation={onRelation} />
        )}
        {unit === null ? null : (
          <DecisionBar
            key={`${unit.id} ${aimed ?? ''}`}
            said={decisionWords(unit, words, aimed)}
            aimed={aimed !== null}
            state={
              view.decision.step !== 'idle' && view.decision.unitId === unit.id
                ? view.decision
                : IDLE
            }
            onAct={onBar}
          />
        )}
      </div>
      <div className="flex min-h-0 flex-col border-l border-border">
        <Justification unit={unit} />
      </div>
    </div>
  );
}
