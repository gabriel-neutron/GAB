import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { DetailSidebar } from '@/features/detail/detail-sidebar';
import { MapPage, nextRow, parseRow, ROW_NAMES, type RowKey } from '@/features/map/map-page';

/**
 * **The route composes.** ADR 0004 §5 refuses a feature that imports a feature, so the map and
 * the detail sidebar are put side by side here and never inside either folder. That rule is what
 * forces the selected identifier out of `features/map/` and into this file.
 *
 * `?entity=` therefore carries the selection. By the test in #33 — would this string mean the
 * same thing to another person, or to you tomorrow? — a selected entity is identity, so it goes
 * in the address and not in `localStorage`. **This settles nothing.** #33 is open, and the
 * prototype reports what the choice costs and what it buys.
 *
 * `?variant=` is prototype scaffolding: it chooses the index row, and it dies with the prototype.
 * The sidebar has no variant of its own — `detail/` settled its layout on 11 August 2026 and
 * `DetailSidebar` now takes an identifier and nothing else.
 */
// Exported because `routeTree.gen.ts` names this type in the declaration it emits for the route,
// and a type it cannot name is an error under `composite`. Nothing imports it.
export interface MapSearch {
  readonly variant: RowKey;
  readonly entity: string;
}

export const Route = createFileRoute('/map')({
  // An unreadable value falls back and never throws. A prototype address is typed by hand.
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    variant: parseRow(search['variant']),
    entity: typeof search['entity'] === 'string' ? search['entity'] : '',
  }),

  component: MapRoute,
  head: () => ({ meta: [{ title: 'Map · Gabriel' }] }),
});

function MapRoute() {
  const { variant, entity } = Route.useSearch();
  const navigate = Route.useNavigate();

  /**
   * The map publishes its selection on `window` and knows nothing about this route. The event is
   * declared in `features/map/prototype-map.ts`, so `event.detail` is typed and no `any` reaches
   * this listener.
   *
   * `replace: true` keeps the browser's back button meaningful: a walk over twenty points should
   * not need twenty presses to leave the map.
   */
  useEffect(() => {
    const onSelection = (event: WindowEventMap['gab:map-selection']): void => {
      void navigate({
        search: (previous: MapSearch) => ({ ...previous, entity: event.detail ?? '' }),
        replace: true,
      });
    };

    window.addEventListener('gab:map-selection', onSelection);
    return () => {
      window.removeEventListener('gab:map-selection', onSelection);
    };
  }, [navigate]);

  return (
    <>
      {/* Full page: one view fills the screen, per ADR 0004 §6. It leaves the padding of the
          root layout, and it covers the theme switch that lives there — a fact about the layout,
          which ADR 0004 defers, and not about the map. */}
      <div className="fixed inset-0 flex overflow-hidden">
        <MapPage row={variant} />
        <DetailSidebar entityId={entity} />
      </div>
      <PrototypeSwitcher
        row={variant}
        onSelect={(next) => {
          void navigate({ search: (previous: MapSearch) => ({ ...previous, variant: next }) });
        }}
      />
    </>
  );
}

/**
 * **PROTOTYPE — throwaway.** The floating bar that flips between the three index rows. It is
 * deliberately ugly, so that nobody mistakes it for the design under review, and it is absent
 * from a production build. It sits in the bottom **right** corner of the window, over the empty
 * foot of the sidebar, because the centre of the screen is where the map draws its attribution.
 */
function PrototypeSwitcher({
  row,
  onSelect,
}: {
  readonly row: RowKey;
  readonly onSelect: (row: RowKey) => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

      // An arrow key inside a field belongs to the field. The rail carries one when a type is open.
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }

      onSelect(nextRow(row, event.key === 'ArrowLeft' ? -1 : 1));
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [row, onSelect]);

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed right-3 bottom-3 z-50 flex items-center gap-1 border border-neutral-600 bg-neutral-950 p-1 font-mono text-xs text-neutral-100 shadow-lg">
      <button
        type="button"
        className="px-2"
        aria-label="Previous row variation"
        onClick={() => {
          onSelect(nextRow(row, -1));
        }}
      >
        {'<'}
      </button>
      <span className="min-w-[16rem] text-center">{`${row} — ${ROW_NAMES[row]}`}</span>
      <button
        type="button"
        className="px-2"
        aria-label="Next row variation"
        onClick={() => {
          onSelect(nextRow(row, 1));
        }}
      >
        {'>'}
      </button>
    </div>
  );
}
