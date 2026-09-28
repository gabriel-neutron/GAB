import { FolderToggle } from '@/shared/folder-toggle';
import { cn } from '@/shared/lib/utils';

import type { RailOpenList } from './entity-list';

export interface IndexRowsProps {
  readonly list: RailOpenList;
  readonly onSelect: (id: string) => void;
  readonly onShowWholeList: () => void;
  readonly onOpen: (unit: string, open: boolean) => void;
}

/** A row is a `<button>` and not a `<div>` with `onClick`: it must reach the keyboard. */
const LINE = cn(
  'pointer-events-auto flex h-6 w-full min-w-0 items-center gap-2 px-1 text-left',
  'border border-transparent transition-colors duration-100',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

/** `tabular-nums` holds the right edge still: proportional digits jump as a digit comes. */
const FIGURE = 'shrink-0 font-mono text-right tabular-nums';

export function IndexRows({ list, onSelect, onShowWholeList, onOpen }: IndexRowsProps) {
  const { entities, remainder } = list;
  return (
    <div role="group">
      {/* Departure: each type holds at least one entity, so an empty list is a filter, or closed
          units, that leave no entity of this type. */}
      {entities.length === 0 ? (
        <p data-no-match="" className="flex h-6 items-center px-1 text-label">
          No entity here holds the filter, or each one is folded under a closed unit.
        </p>
      ) : (
        <p
          data-column=""
          className="flex h-6 items-center gap-2 px-1 text-small/4 tracking-caps text-label uppercase"
        >
          <span className="min-w-0 flex-1 truncate">Name</span>
          <span className="shrink-0">Relations</span>
        </p>
      )}

      {entities.map((entity) => (
        // The fold control and the row are two targets, so they stand side by side, and never one
        // inside the other.
        <div key={entity.id} className="flex h-6 items-center">
          <FolderToggle unit={entity} name={entity.label} onOpen={onOpen} />
          <button
            type="button"
            data-row=""
            data-id={entity.id}
            aria-current={entity.selected ? 'true' : undefined}
            onClick={() => {
              onSelect(entity.id);
            }}
            className={cn(
              LINE,
              entity.selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            )}
          >
            <span className="min-w-0 flex-1 truncate" title={entity.label}>
              {entity.label}
            </span>
            <span className={cn(FIGURE, 'text-label')}>{entity.degree}</span>
          </button>
        </div>
      ))}

      {/* The `aria-label` overrides the visible text. It adds the order the rows come in. */}
      {remainder === 0 ? null : (
        <button
          type="button"
          data-remainder={remainder}
          onClick={onShowWholeList}
          aria-label={`Show the remaining ${remainder}, most connected first`}
          className={cn(LINE, 'hover:bg-muted')}
        >
          <span className="min-w-0 flex-1 truncate text-label">Show {remainder} more</span>
        </button>
      )}
    </div>
  );
}
