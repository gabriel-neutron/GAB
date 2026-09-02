import { cn } from '@/shared/lib/utils';

import type { GeoEntity, TypeFacet } from './projection';

export interface IndexRowsProps {
  readonly facet: TypeFacet;
  readonly entities: readonly GeoEntity[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

/** In a flex row `truncate` needs `min-w-0`: the item defaults to `min-width: auto`. */
const NAME = 'min-w-0 flex-1 truncate';

/** The density and the shape rules: one row of 24px, a 6px cell pad, and no radius. */
const LINE = 'flex h-6 w-full items-center gap-2 rounded-none px-1.5 text-left text-xs';

export function IndexRows({ facet, entities, selectedId, onSelect }: IndexRowsProps) {
  return (
    <div role="group" aria-label={facet.type} data-type={facet.type}>
      {/* The key is `id`. `fid` is a position in an array that MapLibre needs, not an identity. */}
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
