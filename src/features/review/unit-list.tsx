import { useRef } from 'react';

import { proposerWords } from '@/shared/proposer-words';
import { cn } from '@/shared/lib/utils';

import { faultMarks } from './fault-marks';
import { queueWords } from './queue-words';
import type { UnitWords } from './unit-changes';
import type { FaultLevel, Unit, UnitState } from './unit-page';

/** The units read so far, the count of every unit, the count of the units that the filter keeps
 * and of those before the first unit read, and whether a next page waits. */
export interface UnitQueue {
  readonly units: readonly Unit[];
  readonly total: number;
  readonly matched: number;
  readonly before: number;
  readonly filtered: boolean;
  readonly more: 'none' | 'ready' | 'reading';
}

export interface UnitListProps {
  readonly queue: UnitQueue;
  readonly selectedId: string | null;
  readonly words: UnitWords;
  readonly onAct: (act: UnitListAct) => void;
}

/** What the operator did in the left column: open one unit, read the next page, or read the
 * queue again from its first unit. */
export type UnitListAct =
  | { readonly kind: 'select'; readonly unitId: string }
  | { readonly kind: 'more' }
  | { readonly kind: 'start' };

const CONTROL = cn(
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'transition-colors duration-100 hover:bg-muted',
);

const BADGE = 'min-w-0 border border-border px-1 text-small/4';

const typeOf = (unit: Unit, words: UnitWords): string => {
  if (unit.type === null) return 'change';
  return unit.kind === 'entity' ? words.entityType(unit.type) : words.relation(unit.type).label;
};

const groupOf = (unit: Unit): string =>
  unit.group === null ? 'no group' : `group ${unit.group.subject ?? 'with no subject'}`;

// The words say the state, and the hue only points the eye at it.
const STATE_WORDS: Readonly<Record<Exclude<UnitState, 'clean'>, string>> = {
  blocked: 'blocked',
  not_clean: 'not clean',
};

const LEVEL_PAINT: Readonly<Record<FaultLevel, string>> = {
  blocks: 'text-destructive',
  waits: 'text-label',
  not_clean: 'text-dissent',
  information: 'text-label',
};

function Marks({ unit }: { readonly unit: Unit }) {
  const marks = faultMarks(unit.faults);
  if (marks.length === 0) return null;
  return (
    <span
      className="w-full min-w-0 text-small/4"
      title={unit.faults.map((fault) => fault.said).join('\n')}
    >
      {unit.state === 'clean' ? null : (
        <span
          data-state={unit.state}
          className={LEVEL_PAINT[unit.state === 'blocked' ? 'blocks' : 'not_clean']}
        >
          {STATE_WORDS[unit.state]}:{' '}
        </span>
      )}
      {marks.map((mark, at) => (
        <span key={mark.kind}>
          {at === 0 ? null : <span className="text-label"> · </span>}
          <span data-fault={mark.kind} className={LEVEL_PAINT[mark.level]}>
            {mark.words}
          </span>
        </span>
      ))}
    </span>
  );
}

export function UnitList({ queue, selectedId, words, onAct }: UnitListProps) {
  const { units, total, matched, before, filtered, more } = queue;
  // The line of the selected unit scrolls into view once for each unit, also after a reload. A
  // later render does not move the list that the operator scrolled.
  const shown = useRef<string | null>(null);
  const showSelected = (line: HTMLButtonElement | null): void => {
    if (line === null || shown.current === selectedId) return;
    shown.current = selectedId;
    line.scrollIntoView({ block: 'nearest' });
  };
  const said = queueWords({ read: units.length, before, matched, total, filtered });
  return (
    <nav aria-label="Units that wait for a decision" className="flex min-h-0 flex-1 flex-col">
      <p className="shrink-0 border-b border-border px-2 py-1 text-small/4 text-label">
        {said.count}
      </p>
      {before === 0 ? null : (
        <div className="shrink-0 border-b border-border p-1">
          <button
            type="button"
            onClick={() => {
              onAct({ kind: 'start' });
            }}
            className={cn(CONTROL, 'h-6 w-full border border-input px-2 text-xs')}
          >
            Read from the first unit
          </button>
        </div>
      )}
      {said.empty === null ? null : <p className="p-2 text-xs text-label">{said.empty}</p>}
      {units.length === 0 ? null : (
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {units.map((unit) => (
            <li key={unit.id}>
              <button
                type="button"
                data-unit={unit.id}
                ref={unit.id === selectedId ? showSelected : undefined}
                aria-current={unit.id === selectedId ? 'true' : undefined}
                onClick={() => {
                  onAct({ kind: 'select', unitId: unit.id });
                }}
                className={cn(
                  CONTROL,
                  'flex w-full flex-col border-b border-l-2 border-b-border border-l-transparent px-2 py-1 text-left text-xs',
                  unit.id === selectedId ? 'border-l-primary bg-muted' : null,
                )}
              >
                {/* The name takes the whole first line, so a narrow screen still shows it. */}
                <span className="w-full min-w-0 truncate" title={unit.name}>
                  {unit.name}
                </span>
                <span
                  className="flex w-full min-w-0 items-center gap-1 py-0.5"
                  title={`${proposerWords(unit.proposer)}, ${typeOf(unit, words)}, ${groupOf(unit)}`}
                >
                  <span
                    data-badge="type"
                    title={typeOf(unit, words)}
                    className={cn(BADGE, 'truncate text-foreground')}
                  >
                    {typeOf(unit, words)}
                  </span>
                  <span data-badge="proposer" className={cn(BADGE, 'shrink-0 text-label')}>
                    {proposerWords(unit.proposer)}
                  </span>
                  <span className="sr-only">{groupOf(unit)}</span>
                </span>
                <Marks unit={unit} />
              </button>
            </li>
          ))}
          {more === 'none' ? null : (
            <li className="p-2">
              <button
                type="button"
                disabled={more === 'reading'}
                onClick={() => {
                  onAct({ kind: 'more' });
                }}
                className={cn(CONTROL, 'h-6 w-full border border-input px-2 text-xs')}
              >
                {more === 'reading' ? 'Reading the next units' : 'Read the next units'}
              </button>
            </li>
          )}
        </ul>
      )}
    </nav>
  );
}
