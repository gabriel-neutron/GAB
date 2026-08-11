/**
 * **PROTOTYPE — throwaway.** The floating bar. It flips between the two surfaces and it reaches
 * the density probe. It is deliberately plain, so
 * that nobody reads it as part of the design, and it is absent from a production build.
 *
 * It navigates through a callback, so this feature knows no route address. The route owns the
 * navigation, as it owns the composition.
 */

import { Button } from '@/shared/ui/button';
import { DENSE_ENTITY_ID } from './prototype-dense';
import { SURFACE_NAMES, type Surface } from './prototype-variants';

export function PrototypeSwitcher({
  surface,
  onSelect,
}: {
  surface: Surface;
  onSelect: (surface: Surface) => void;
}) {
  if (import.meta.env.PROD) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 border-2 border-foreground bg-background px-2 py-1.5 shadow-lg">
        <Button
          size="sm"
          variant={surface === 'page' ? 'default' : 'ghost'}
          onClick={() => {
            onSelect('page');
          }}
        >
          {SURFACE_NAMES.page}
        </Button>
        <Button
          size="sm"
          variant={surface === 'sidebar' ? 'default' : 'ghost'}
          onClick={() => {
            onSelect('sidebar');
          }}
        >
          {SURFACE_NAMES.sidebar}
        </Button>

        <span className="mx-1 h-4 w-px bg-border" />

        <a
          className="px-1 text-xs underline underline-offset-2"
          href={`/entity/${DENSE_ENTITY_ID}?surface=${surface}`}
        >
          Probe
        </a>
        <a
          className="px-1 text-xs underline underline-offset-2"
          href={`/entity/x?surface=${surface}`}
        >
          All entities
        </a>
      </div>
    </div>
  );
}
