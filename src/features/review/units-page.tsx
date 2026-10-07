import type { Decision } from '@gab/proposal/request';
import { useState } from 'react';

import { ChangeList } from './change-list';
import { DecisionBar, type BarAct, type DecisionState } from './decision-bar';
import { decisionWords } from './decision-words';
import { Justification } from './justification';
import type { UnitWords } from './unit-changes';
import { UnitList, type UnitListAct, type UnitQueue } from './unit-list';

/** The queue as this page holds it with the decision that it stands in, or the sentence that
 * says why it holds none. */
export type QueueView =
  | { readonly state: 'held'; readonly queue: UnitQueue; readonly decision: DecisionState }
  | { readonly state: 'private'; readonly why: string };

/** What the operator did on the page: open a unit, read the next page, or decide one unit. */
export type ReviewAct =
  UnitListAct | { readonly kind: 'decide'; readonly unitId: string; readonly decision: Decision };

export interface UnitsPageProps {
  readonly view: QueueView;
  /** The unit under examination. An unknown or empty identifier opens the first unit. */
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
  const unit = units.find((held) => held.id === selectedId) ?? units[0] ?? null;
  const aimed =
    unit !== null &&
    aim !== null &&
    aim.unitId === unit.id &&
    unit.acts.some((act) => act.id === aim.relationId)
      ? aim.relationId
      : null;

  const onBar = (act: BarAct): void => {
    if (unit === null) return;
    switch (act.kind) {
      case 'unaim':
        setAim(null);
        return;
      case 'promote':
        onAct({
          kind: 'decide',
          unitId: unit.id,
          decision: { op: 'promote_unit', unitId: unit.id },
        });
        return;
      case 'reject': {
        const { reason, note } = act;
        const written = note === undefined ? {} : { note };
        onAct({
          kind: 'decide',
          unitId: unit.id,
          decision:
            aimed === null
              ? { op: 'reject_unit', unitId: unit.id, reason, ...written }
              : { op: 'reject_relation', proposalId: aimed, reason, ...written },
        });
        return;
      }
    }
  };

  return (
    <div
      data-units-page
      className="grid h-full min-h-0 grid-cols-[clamp(16rem,26%,22rem)_minmax(0,1fr)_clamp(15rem,28%,26rem)] overflow-hidden"
    >
      <div className="flex min-h-0 flex-col border-r border-border">
        <UnitList queue={view.queue} selectedId={unit?.id ?? null} words={words} onAct={onAct} />
      </div>
      <div className="flex min-h-0 flex-col">
        <ChangeList
          unit={unit}
          words={words}
          aimed={aimed}
          onAim={(relationId) => {
            if (unit !== null) setAim({ unitId: unit.id, relationId });
          }}
        />
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
