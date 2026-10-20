import type { KeyboardEvent } from 'react';

import { cn } from '@/shared/lib/utils';

import type { TextView } from './text-view';

interface TextViewListProps {
  readonly view: TextView | null;
  /** A neighbour was opened: the graph draws a focus on it. */
  readonly onOpenEntity: (id: string) => void;
  /** A relation was opened: the graph selects it. */
  readonly onOpenRelation: (id: string) => void;
}

const BUTTON = cn(
  'min-w-0 truncate border border-transparent px-1 text-left',
  'transition-colors duration-100 hover:bg-muted',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

const isColumn = (value: string | undefined): value is 'entity' | 'relation' =>
  value === 'entity' || value === 'relation';

// Departure: Tab already reaches every button. The arrows add a walk on top of it, so a reader
// steps down the neighbours, and across from a neighbour to its relation, without the Tab key.
function walk(event: KeyboardEvent<HTMLElement>): void {
  const section = event.currentTarget;
  if (event.key === 'Escape') {
    section.focus();
    return;
  }
  const target = event.target instanceof HTMLElement ? event.target : null;
  const column = target?.dataset['walk'];
  const vertical = event.key === 'ArrowDown' || event.key === 'ArrowUp';
  const sideways = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
  if (!vertical && !sideways) return;
  event.preventDefault();

  if (!isColumn(column)) {
    if (vertical) section.querySelector<HTMLElement>('[data-walk="entity"]')?.focus();
    return;
  }
  if (sideways) {
    const row = target?.closest('li');
    const other = column === 'entity' ? 'relation' : 'entity';
    row?.querySelector<HTMLElement>(`[data-walk="${other}"]`)?.focus();
    return;
  }
  const cells = [...section.querySelectorAll<HTMLElement>(`[data-walk="${column}"]`)];
  const at = target === null ? -1 : cells.indexOf(target);
  const next = cells[event.key === 'ArrowDown' ? at + 1 : at - 1];
  next?.focus();
}

const plural = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

// The list says in words what the drawing says in lines. A reader with a keyboard or a screen
// reader selects, walks and opens from here. The line under the title is a live region, so a
// change of the selection is announced.
export function TextViewList({ view, onOpenEntity, onOpenRelation }: TextViewListProps) {
  return (
    <section
      aria-label="Text view of the selection"
      tabIndex={-1}
      onKeyDown={walk}
      className={cn('max-w-prose outline-none focus-visible:ring-3 focus-visible:ring-ring/50')}
    >
      <p role="status" className={cn('text-foreground')}>
        {view === null
          ? 'Nothing is selected. Choose an entity in the lists to see its neighbours here.'
          : `${view.name}: ${plural(view.rows.length, 'neighbour', 'neighbours')}.`}
      </p>
      {view === null || view.rows.length === 0 ? null : (
        <>
          <p className={cn('text-muted-foreground')}>
            Arrow keys walk the list. Enter opens. Escape leaves.
          </p>
          <ul className={cn('mt-1')}>
            {view.rows.map((row) => (
              <li
                key={`${row.relationId}-${row.entityId}-${row.direction}`}
                className={cn('flex h-6 items-center gap-2')}
              >
                <button
                  type="button"
                  data-walk="entity"
                  onClick={(event) => {
                    // The row dies with the selection, so focus moves to a stable element first.
                    event.currentTarget.closest('section')?.focus();
                    onOpenEntity(row.entityId);
                  }}
                  className={cn(BUTTON, 'max-w-64 text-foreground')}
                >
                  {row.label}
                </button>
                {view.kind === 'relation' ? (
                  <span className={cn('text-muted-foreground')}>
                    {row.direction === 'out' ? 'source' : 'target'}
                  </span>
                ) : (
                  <button
                    type="button"
                    data-walk="relation"
                    onClick={(event) => {
                      event.currentTarget.closest('section')?.focus();
                      onOpenRelation(row.relationId);
                    }}
                    className={cn(BUTTON, 'max-w-64 text-muted-foreground')}
                  >
                    {`${row.relation} (${row.direction === 'out' ? 'outgoing' : 'incoming'})`}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
