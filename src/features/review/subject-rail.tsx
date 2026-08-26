import { cn } from '@/shared/lib/utils';

import { KindGlyph, KIND_PAINT } from './change-mark';
import { ContestedGlyph } from './contested-mark';
import type { ChangeKind, SortKey, SubjectRow } from './queue';
import { SORT_KEYS, SORT_WORDS } from './queue';

/** What waits for a decision, in the order in force, and which subject is open. */
export interface SubjectQueue {
  readonly rows: readonly SubjectRow[];
  readonly currentId: string | null;
  readonly sort: SortKey;
}

export interface SubjectRailProps {
  readonly queue: SubjectQueue;
  readonly onSelect: (subjectId: string) => void;
  readonly onSort: (sort: SortKey) => void;
}

const CONTROL = cn(
  'flex h-6 items-center border border-transparent px-1.5 text-left text-xs',
  'transition-colors duration-100 hover:bg-muted',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

/** The three hues the operator asked for. A merge takes rows away, so it joins the deletion. */
const RULE: Readonly<Record<ChangeKind, string>> = {
  add: 'border-l-added',
  edit: 'border-l-candidate',
  delete: 'border-l-dissent',
  merge: 'border-l-dissent',
};

/** The round badge the operator asked for, and the one round shape in a repository whose radius
 * is 0. The ring carries the shape and no fill sits under the figure: a 15 percent tint took the
 * figure to 3.97 on a selected dark row. The bare hue holds 4.69 at worst on the two grounds. */
const COUNT = 'inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full border px-1.5';

export function SubjectRail({ queue, onSelect, onSort }: SubjectRailProps) {
  const { rows, currentId, sort } = queue;
  return (
    <nav aria-label="What waits for a decision" className="flex min-h-0 flex-col">
      {/* A control that orders nothing is not drawn. */}
      {rows.length === 0 ? null : (
        <div className="flex h-6 shrink-0 items-center gap-1 px-1.5">
          <span className="shrink-0 text-small/4 tracking-caps text-label uppercase">Order</span>
          {SORT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === sort}
              onClick={() => {
                onSort(key);
              }}
              className={cn(
                CONTROL,
                'shrink-0 px-1 text-small/4',
                key === sort ? 'bg-muted text-foreground' : 'text-label',
              )}
            >
              {SORT_WORDS[key]}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="p-2 text-xs text-label">
          Nothing waits for a decision. No act of the record stands pending, and none was dropped.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                data-subject={row.id}
                data-rule={row.rule}
                aria-current={row.id === currentId ? 'true' : undefined}
                aria-label={row.name}
                onClick={() => {
                  onSelect(row.id);
                }}
                className={cn(
                  CONTROL,
                  'w-full gap-1.5 border-l-2',
                  RULE[row.rule],
                  row.id === currentId ? 'bg-muted' : null,
                )}
              >
                <span className="min-w-0 flex-1 truncate" title={row.label}>
                  {row.label}
                </span>
                {/* The case the node was made the unit for. The word is in the row name. */}
                {row.contested ? <ContestedGlyph /> : null}
                {/* How many acts of each kind wait. A kind the subject does not carry is not a
                    zero on the screen: it is absent. The row name holds the count in words. */}
                {row.counts.map((held) => (
                  <span
                    key={held.kind}
                    data-count={held.kind}
                    aria-hidden="true"
                    className={cn(COUNT, 'border-current', KIND_PAINT[held.kind])}
                  >
                    <KindGlyph kind={held.kind} kindWords={held.words} />
                    <span className="font-mono text-small/4 tabular-nums">{held.count}</span>
                  </span>
                ))}
                {/* How much of this subject is settled. A track at zero says nothing. */}
                {row.settledFill === 0 ? null : (
                  <span aria-hidden="true" className="block h-1 w-4 shrink-0 bg-muted">
                    <span
                      style={{ width: `${String(row.settledFill)}%` }}
                      className="block h-1 bg-primary"
                    />
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
