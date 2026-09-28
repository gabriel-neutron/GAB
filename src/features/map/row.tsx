import { cn } from '@/shared/lib/utils';

import type { GeoEntity, TypeFacet } from './projection';
import { UnitSymbol } from './unit-symbol';

export interface IndexRowsProps {
  readonly facet: TypeFacet;
  readonly entities: readonly GeoEntity[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

// This callback is one module constant, so React runs it only when the selection moves to another
// row. `nearest` moves the index alone and leaves every ancestor of it still, and it moves nothing
// at all for a row that is already on the screen, such as the row the analyst just clicked.
const reveal = (node: HTMLElement | null): void => {
  node?.scrollIntoView({ block: 'nearest' });
};

/** In a flex row `truncate` needs `min-w-0`: the item defaults to `min-width: auto`. */
const NAME = 'min-w-0 flex-1 truncate';

/** The density and the shape rules: one row of 24px, a 6px cell pad, and no radius. */
const LINE = 'flex h-6 w-full items-center gap-2 rounded-none px-1.5 text-left text-xs';

// The borrowed position, beside the name and never under it: the row is one line of 24px, and a
// second line would break the density of the whole index. It takes at most half the row, so a
// long parent label never crowds out the name the analyst is reading.
const FROM = 'max-w-[45%] shrink-0 truncate text-muted-foreground';

// The echelon and the domain in words, beside the graphic that draws them. A reader who reads no
// military symbol must be able to name what the frame says, and only words can do that.
const READING = 'max-w-[40%] truncate text-muted-foreground';

export function IndexRows({ facet, entities, selectedId, onSelect }: IndexRowsProps) {
  return (
    <div role="group" aria-label={facet.type} data-type={facet.type}>
      {/* Departure: a facet exists only for a type with a drawn entity, so an empty list is a
          filter that holds no name of this type. */}
      {entities.length === 0 ? (
        <p data-no-match="" className="flex h-6 items-center px-1.5 text-xs text-label">
          No name holds the filter.
        </p>
      ) : null}
      {/* The key is `id`. `fid` is a position in an array that MapLibre needs, not an identity. */}
      {entities.map((entity) => {
        const said = entity.symbol?.words ?? null;
        return (
          <button
            key={entity.id}
            type="button"
            data-row=""
            data-id={entity.id}
            ref={entity.id === selectedId ? reveal : undefined}
            aria-current={entity.id === selectedId ? 'true' : undefined}
            onClick={() => {
              onSelect(entity.id);
            }}
            className={cn(
              LINE,
              // `duration-100` alone gives `transition-property: all`, which moves everything.
              'transition-colors duration-100',
              // The focus ring of the kit, exactly. `ring` alone paints at rest, and with no
              // colour utility it paints `currentcolor` and not the token.
              'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              entity.id === selectedId ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
            )}
          >
            <UnitSymbol symbol={entity.symbol} />
            <span className={NAME} title={entity.label}>
              {entity.label}
            </span>
            {said === null ? null : (
              <span className={READING} data-symbol-words="" title={said}>
                {said}
              </span>
            )}
            {/* The halo on the canvas says THAT the position is borrowed; this row is not the
              canvas, so the words are the only thing that can say it here. They carry the same
              wording as the hover label and the detail panel, from one function. */}
            {entity.positionFrom === null ? null : (
              <span className={FROM} data-position-from="">
                {entity.positionFrom}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
