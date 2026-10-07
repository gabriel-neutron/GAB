import { proposerWords } from '@/shared/proposer-words';
import { cn } from '@/shared/lib/utils';

import type { UnitWords } from './unit-changes';
import type { Unit } from './unit-page';

/** The units read so far, the count of every unit, and whether a next page waits. */
export interface UnitQueue {
  readonly units: readonly Unit[];
  readonly total: number;
  readonly more: 'none' | 'ready' | 'reading';
}

export interface UnitListProps {
  readonly queue: UnitQueue;
  readonly selectedId: string | null;
  readonly words: UnitWords;
  readonly onAct: (act: UnitListAct) => void;
}

/** What the operator did in the left column: open one unit, or read the next page. */
export type UnitListAct =
  { readonly kind: 'select'; readonly unitId: string } | { readonly kind: 'more' };

const CONTROL = cn(
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  'transition-colors duration-100 hover:bg-muted',
);

const typeOf = (unit: Unit, words: UnitWords): string => {
  if (unit.type === null) return 'change';
  return unit.kind === 'entity' ? words.entityType(unit.type) : words.relation(unit.type).label;
};

const groupOf = (unit: Unit): string =>
  unit.group === null ? 'no group' : `group ${unit.group.subject ?? 'with no subject'}`;

export function UnitList({ queue, selectedId, words, onAct }: UnitListProps) {
  const { units, total, more } = queue;
  return (
    <nav aria-label="Units that wait for a decision" className="flex min-h-0 flex-col">
      <p className="h-6 shrink-0 border-b border-border px-2 text-small/4 leading-6 text-label">
        {units.length === total
          ? `${String(total)} units wait`
          : `${String(units.length)} of ${String(total)} units read`}
      </p>
      {units.length === 0 ? (
        <p className="p-2 text-xs text-label">The queue is empty.</p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {units.map((unit) => (
            <li key={unit.id}>
              <button
                type="button"
                data-unit={unit.id}
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
                  className="w-full min-w-0 truncate text-small/4 text-label"
                  title={`${proposerWords(unit.proposer)}, ${typeOf(unit, words)}, ${groupOf(unit)}`}
                >
                  {proposerWords(unit.proposer)} · {typeOf(unit, words)} · {groupOf(unit)}
                </span>
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
