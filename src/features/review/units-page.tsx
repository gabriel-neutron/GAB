import { ChangeList } from './change-list';
import { Justification } from './justification';
import type { UnitWords } from './unit-changes';
import { UnitList, type UnitListAct, type UnitQueue } from './unit-list';

/** The queue as this page holds it, or the sentence that says why it holds none. */
export type QueueView =
  | { readonly state: 'held'; readonly queue: UnitQueue }
  | { readonly state: 'private'; readonly why: string };

export interface UnitsPageProps {
  readonly view: QueueView;
  /** The unit under examination. An unknown or empty identifier opens the first unit. */
  readonly selectedId: string;
  readonly words: UnitWords;
  readonly onAct: (act: UnitListAct) => void;
}

/** The review queue in three columns: the units, the changes of one unit, and why it waits. Each
 * column scrolls on its own, so the page itself never scrolls under the lists. */
export function UnitsPage({ view, selectedId, words, onAct }: UnitsPageProps) {
  if (view.state === 'private') return <p className="p-3 text-xs text-label">{view.why}</p>;
  const { units } = view.queue;
  const unit = units.find((held) => held.id === selectedId) ?? units[0] ?? null;
  return (
    <div
      data-units-page
      className="grid h-full min-h-0 grid-cols-[clamp(16rem,26%,22rem)_minmax(0,1fr)_clamp(15rem,28%,26rem)] overflow-hidden"
    >
      <div className="flex min-h-0 flex-col border-r border-border">
        <UnitList queue={view.queue} selectedId={unit?.id ?? null} words={words} onAct={onAct} />
      </div>
      <div className="flex min-h-0 flex-col">
        <ChangeList unit={unit} words={words} />
      </div>
      <div className="flex min-h-0 flex-col border-l border-border">
        <Justification unit={unit} />
      </div>
    </div>
  );
}
