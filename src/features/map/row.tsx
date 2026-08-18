/**
 * One line of the index: the name of an entity, and nothing else.
 *
 * Built from `docs/map-surface.md` §4.6 and step 7 of §8, with the rules of §5.5.
 *
 * **The one column of values is gone** — #81 rows B5, B6 and B7. The operator ruled that the rail
 * shows the name of an entity and that **only the type makes a layer**. Three things left with the
 * column:
 *
 * - **The header, which drew a raw machine key** — `throughput_kt_month`, underscores and all. The
 *   key was machine-derived, because ADR 0005 §6 forbids a hand-kept table of the key that matters
 *   for a type. **#12** owns a readable name for an attribute, and **#93** gives a type its own
 *   readable label.
 * - **The blank cell of `decisions.md` M9.** M9 is untouched and it still holds: a blank reads as
 *   an absence only under a header that says what the column holds. There is no column here now,
 *   so there is no blank to read.
 * - **The sentence for a group that a filter emptied.** The search field goes with #82 C6, and
 *   **#90 GLOBAL-SEARCH** holds the capability, so no filter can empty a group from this rail.
 *
 * **The values are not lost to the analyst.** The dossier at the right lists every attribute of a
 * selected entity, with its sources.
 */

import { cn } from '@/shared/lib/utils';

import type { GeoEntity, TypeFacet } from './projection';

export interface IndexRowsProps {
  /** The type this group draws. `./projection` derives it. */
  readonly facet: TypeFacet;
  /** The entities of that type, in the order the group shows them. The caller chooses it. */
  readonly entities: readonly GeoEntity[];
  /** The entity that is selected on the map, or `null`. §5.1 keeps the map the only writer. */
  readonly selectedId: string | null;
  /** A row selects an entity, and the caller moves the camera to it. */
  readonly onSelect: (id: string) => void;
}

/**
 * Rule 16: a value truncates and never wraps. `truncate` alone does nothing in a flex row,
 * because the item defaults to `min-width: auto` and pushes its neighbour off the line.
 */
const NAME = 'min-w-0 flex-1 truncate';

/** Rule 5 and the density of §5.5: one row of 24px, a 6px cell pad, and no radius. */
const LINE = 'flex h-6 w-full items-center gap-2 rounded-none px-1.5 text-left text-xs';

export function IndexRows({ facet, entities, selectedId, onSelect }: IndexRowsProps) {
  return (
    <div role="group" aria-label={facet.type} data-type={facet.type}>
      {/* The one `.map` of this file. It is keyed by `id`, the identity of the row: `fid` is a
          position in an array that MapLibre needs, and it is not an identity. */}
      {entities.map((entity) => (
        <button
          key={entity.id}
          type="button"
          data-row=""
          data-id={entity.id}
          aria-current={entity.id === selectedId ? 'true' : undefined}
          onClick={() => {
            onSelect(entity.id);
          }}
          className={cn(
            LINE,
            // A state change of the colour lasts under 120ms, and nothing else moves.
            // `duration-100` alone gives `transition-property: all`, which moves everything.
            'transition-colors duration-100',
            // The focus ring of the kit, exactly. `ring` alone paints at rest, and with no
            // colour utility it paints `currentcolor` and not the token.
            'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            entity.id === selectedId ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
          )}
        >
          <span className={NAME} title={entity.label}>
            {entity.label}
          </span>
        </button>
      ))}
    </div>
  );
}
