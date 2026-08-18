/**
 * The index of one type, on the graph — a name and a count of relations, capped.
 *
 * Built from `docs/graph-surface.md` §4.4, and from the two differences from the map that the
 * section names: the list is capped and **the remainder is on the screen**, and the list is in the
 * order of the degree, because the useful head of a list on a graph is the hubs.
 *
 * **The remainder is a control now** — #82 C8. The line said "n more. Use the field.", which
 * counted the rows the cap dropped and then sent the analyst to a search field that #82 C6
 * removed. It opens the list instead, in the same order: the most connected first.
 *
 * **The figure carries its name on the screen** — #82 C7. A bare number at the end of a row does
 * not say what it measures, and the name reached a screen reader alone. One header above the list
 * names the column for every row under it, which is the treatment the map used for its own column
 * (M9) before #81 B6 removed that column.
 *
 * **It is a sibling of the shared rail, and not a part of it.** `src/shared/rail.tsx` owns the
 * control — the fold, the type rows and the strip — and the row is not the same component on the
 * two surfaces: the map draws a name alone, and this draws a count of relations. §4.4 calls the
 * rail "the same **control** as the map's", and the control is what is shared.
 *
 * **It derives nothing.** `./rail-rows` sorted the list, applied the cap and counted the
 * remainder, so this file turns one already-derived array into elements.
 */

import { cn } from '@/shared/lib/utils';

import type { RailEntityRow } from './rail-rows';

export interface IndexRowsProps {
  /** The entities of one open type, already sorted and already capped. */
  readonly entities: readonly RailEntityRow[];
  /** How many entities the cap leaves out. 0 once the whole list is open — #82 C8. */
  readonly remainder: number;
  /** A row selects an entity, and the caller moves the camera to it. */
  readonly onSelect: (id: string) => void;
  /** The analyst asked for the rows the cap dropped — #82 C8. */
  readonly onShowWholeList: () => void;
}

/** One line that acts. It is a real control, so it reaches the keyboard and the reader. */
const LINE = cn(
  'pointer-events-auto flex h-6 w-full items-center gap-2 px-1 text-left',
  'border border-transparent transition-colors duration-100',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

/** A column of figures — one right edge, and no jump as a digit is added. */
const FIGURE = 'shrink-0 font-mono text-right tabular-nums';

export function IndexRows({ entities, remainder, onSelect, onShowWholeList }: IndexRowsProps) {
  return (
    <div role="group">
      {/* #82 C7: the column is named once, on the screen, above every row it describes. The word
          is the reason the list is ordered as it is, so it belongs beside the list and not inside
          each of sixty rows. */}
      {entities.length === 0 ? null : (
        <p
          data-column=""
          className="flex h-6 items-center gap-2 px-1 text-[11px]/4 tracking-[0.06em] text-label uppercase"
        >
          <span className="min-w-0 flex-1 truncate">Name</span>
          <span className="shrink-0">Relations</span>
        </p>
      )}

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
          <span className={cn(FIGURE, 'text-label')}>{entity.degree}</span>
        </button>
      ))}

      {/* §4.4: the list is capped, and **the remainder is on the screen**. A surface that drops
          rows in silence is worse than one that says how many it dropped.

          **#82 C8 makes it the control that draws them.** The name says the whole act, because
          "Show 47 more" alone does not say what they are or in what order they come. */}
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
