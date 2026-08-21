import { cn } from '@/shared/lib/utils';

import type { RailEntityRow } from './rail-rows';

export interface IndexRowsProps {
  readonly entities: readonly RailEntityRow[];
  readonly remainder: number;
  readonly onSelect: (id: string) => void;
  readonly onShowWholeList: () => void;
}

/** A row is a `<button>` and not a `<div>` with `onClick`: it must reach the keyboard. */
const LINE = cn(
  'pointer-events-auto flex h-6 w-full items-center gap-2 px-1 text-left',
  'border border-transparent transition-colors duration-100',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

/** `tabular-nums` holds the right edge still: proportional digits jump as a digit comes. */
const FIGURE = 'shrink-0 font-mono text-right tabular-nums';

export function IndexRows({ entities, remainder, onSelect, onShowWholeList }: IndexRowsProps) {
  return (
    <div role="group">
      {entities.length === 0 ? null : (
        <p
          data-column=""
          className="flex h-6 items-center gap-2 px-1 text-[11px]/4 tracking-[0.06em] text-label uppercase"
        >
          <span className="min-w-0 flex-1 truncate">Name</span>
          <span className="shrink-0">Relations</span>
        </p>
      )}

      {entities.map((entity) => (
        <button
          key={entity.id}
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
