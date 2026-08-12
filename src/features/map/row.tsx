/**
 * One line of the index, and the header that names its column.
 *
 * Built from `docs/map-surface.md` §4.6 and step 7 of §8, with the rules of §5.5. The key of the
 * column comes from `TypeFacet.key`, which `./projection` derives — §3.2 and ADR 0005 §6 forbid a
 * hand-kept table of the key that matters for a type, so nothing here recomputes it and nothing
 * here names an attribute.
 *
 * **The header is not decoration.** The column is blank wherever an entity does not carry the key,
 * and a blank reads as an absence only under a header that says what the column holds (M9).
 */

import { cn } from '@/shared/lib/utils';

import type { GeoEntity, TypeFacet } from './projection';

export interface IndexRowsProps {
  /** The type this group draws, and the key of its one column. `./projection` derives both. */
  readonly facet: TypeFacet;
  /** The entities of that type, in the order the group shows them. The caller chooses it. */
  readonly entities: readonly GeoEntity[];
  /** The entity that is selected on the map, or `null`. §5.1 keeps the map the only writer. */
  readonly selectedId: string | null;
  /** A row selects an entity, and the caller moves the camera to it. */
  readonly onSelect: (id: string) => void;
}

/**
 * The width of the one column, so that every value ends on one right edge. Rule 13 aligns a
 * column of figures, and a column that reads down is the check of step 7.
 */
const COLUMN = 'w-20 shrink-0 truncate text-right font-mono tabular-nums';

/**
 * Rule 16: a value truncates and never wraps. `truncate` alone does nothing in a flex row,
 * because the item defaults to `min-width: auto` and pushes its neighbour off the line.
 */
const NAME = 'min-w-0 flex-1 truncate';

/** Rule 5 and the density of §5.5: one row of 24px, a 6px cell pad, and no radius. */
const LINE = 'flex h-6 w-full items-center gap-2 rounded-none px-1.5 text-left text-xs';

/**
 * The header of the column, on a line of its own.
 *
 * **The header must name the key in full.** In the 80px box of the column, `throughput_kt_month`
 * clips on the screen to `throughput_kt_m…`, and a clipped header does not say what the column
 * holds. A `title` is the treatment of a value in a row, and not of a header. So the header takes
 * the full width of the group, above the rows, and it never truncates. It keeps the right edge of
 * the column, so the reader joins the two.
 */
const HEADER = 'h-6 w-full px-1.5 py-1 text-right font-mono text-[11px]/4 tracking-[0.06em]';

export function IndexRows({ facet, entities, selectedId, onSelect }: IndexRowsProps) {
  return (
    <div role="group" aria-label={facet.type} data-type={facet.type}>
      {/* The header names the key. **The machine key is drawn as the machine derived it**,
          underscores and all: §3.2 gives the attribute vocabulary to #12 and says the rebuild
          must not answer it in code. It is a machine key, so rule 12 draws it in monospace.

          **`facet.key` is `null` when the type carries no attribute at all**, and §4.6 does not
          say what the group draws then. The header goes, and the column of the rows goes with it:
          a blank of 80px under no header is what M9 refuses. The question is under ASK. */}
      {facet.key === null ? null : (
        <div className={cn(HEADER, 'text-label')} data-column-key="">
          {facet.key}
        </div>
      )}
      {entities.length === 0 ? (
        /* An empty group says the count and the reason. The caller filters and searches, so the
           only cause of an empty list is that filter. §4.5 makes the search a control on it. */
        <p className="px-1.5 py-1 text-xs text-muted-foreground" data-empty="">
          The filter shows 0 of the {facet.count} entities of this type.
        </p>
      ) : null}
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
          {/* The cell. An empty value is a blank cell and never `N/A`, never a dash and never
              `0` — the header above says what the column holds. `./projection` renders the
              text, so this file joins nothing and formats nothing. */}
          {facet.key === null ? null : (
            <span
              className={cn(COLUMN, 'text-muted-foreground')}
              data-cell=""
              title={entity.keyValue === '' ? undefined : entity.keyValue}
            >
              {entity.keyValue}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
