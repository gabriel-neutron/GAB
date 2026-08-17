/**
 * The index of one type, on the graph — a name and a degree, capped.
 *
 * Built from `docs/graph-surface.md` §4.4, and from the two differences from the map that the
 * section names: the list is capped and **the remainder is on the screen**, and the list is in the
 * order of the degree, because the useful head of a list on a graph is the hubs.
 *
 * **It is a sibling of the shared rail, and not a part of it.** `src/shared/rail.tsx` owns the
 * control — the fold, the type rows, the field and the strip — and the row is not the same
 * component on the two surfaces: the map draws the one key that most entities of a type carry,
 * under a header that names it (M9), and this draws a degree. §4.4 calls the rail "the same
 * **control** as the map's", and the control is what is shared.
 *
 * **It derives nothing.** `./rail-rows` sorted the list, applied the cap and counted the
 * remainder, so this file turns one already-derived array into elements.
 */

import { cn } from '@/shared/lib/utils';

import type { RailEntityRow } from './rail-rows';

export interface IndexRowsProps {
  /** The entities of the open type, already sorted and already capped. */
  readonly entities: readonly RailEntityRow[];
  /** How many entities match and are not drawn. §4.4 puts this number on the screen. */
  readonly remainder: number;
  /** How many entities of this type the canvas draws, for the line that says no name matches. */
  readonly count: number;
  /** A row selects an entity, and the caller moves the camera to it. */
  readonly onSelect: (id: string) => void;
}

/** One line that acts. It is a real control, so it reaches the keyboard and the reader. */
const LINE = cn(
  'pointer-events-auto flex h-6 w-full items-center gap-2 px-1 text-left',
  'border border-transparent transition-colors duration-100',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

/** A column of figures — one right edge, and no jump as a digit is added. */
const FIGURE = 'shrink-0 font-mono text-right tabular-nums';

export function IndexRows({ entities, remainder, count, onSelect }: IndexRowsProps) {
  return (
    <div role="group">
      {/* The one `.map` of this file. It is keyed by the identity of the entity. */}
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
          {/* The degree is the reason this list is ordered as it is, so the row shows it. There
              is no column header on this list, so the name of the figure reaches a reader as
              hidden words: a bare number says nothing about what it measures. */}
          <span className="sr-only">degree</span>
          <span className={cn(FIGURE, 'text-label')}>{entity.degree}</span>
        </button>
      ))}

      {/* §4.4: the list is capped, and **the remainder is on the screen**. A surface that drops
          rows in silence is worse than one that says how many it dropped. */}
      {remainder === 0 ? null : (
        <p data-remainder={remainder} className="flex h-6 items-center px-1 text-label">
          {remainder} more. Use the field.
        </p>
      )}

      {entities.length === 0 ? (
        <p data-no-match="" className="flex h-6 items-center px-1 text-label">
          No name matches. This type has {count} entities.
        </p>
      ) : null}
    </div>
  );
}
