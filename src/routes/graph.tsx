import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DetailSidebar } from '@/features/detail/detail-sidebar';
import { findEntity } from '@/features/detail/prototype-data';
import {
  onGraphCost,
  onGraphSelection,
  type GraphSelectionDetail,
} from '@/features/graph/prototype-bridge';
import { GraphSurface } from '@/features/graph/graph-surface';

/**
 * PROTOTYPE host for the graph.
 *
 * **The route owns the address and the composition.** That split is not cosmetic. A search
 * parameter is React state, and ADR 0004 §3 refuses React state inside `features/graph/`; and
 * ADR 0004 §5 refuses a feature that imports a feature, so the sidebar of `features/detail/` can
 * only be put beside the canvas here. `routes/entity.$id.tsx` says the same from the other side,
 * and called its neighbour a placeholder until a route like this one existed.
 *
 * The graph re-renders nothing when the selection changes. The selection arrives as a window
 * event, this component holds it, and `memo` on the surface means the canvas is never touched.
 *
 * `?n=` is the entity count, and it is **scaffolding**: it exists to measure the cost of a
 * browser layout for #35, and it dies with the prototype. There is no `?variant=` any more —
 * the operator chose the immersive canvas, and the other two surfaces are retired.
 */
export interface GraphSearch {
  readonly n: number;
}

/** The sizes the cost curve of #35 is measured at. */
const ENTITY_COUNTS: readonly number[] = [1000, 5000, 10000, 25000];

export const Route = createFileRoute('/graph')({
  component: GraphRoute,
  head: () => ({ meta: [{ title: 'Graph · Gabriel' }] }),
  validateSearch: (search: Record<string, unknown>): GraphSearch => {
    const raw = Number(search['n']);
    return { n: ENTITY_COUNTS.includes(raw) ? raw : 10000 };
  },
});

function GraphRoute() {
  const { n } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [selection, setSelection] = useState<GraphSelectionDetail | null>(null);
  const [cost, setCost] = useState('');

  useEffect(() => onGraphSelection(setSelection), []);
  useEffect(() => onGraphCost(setCost), []);

  return (
    <div className="flex h-[calc(100svh-6.5rem)] w-full">
      <div className="min-w-0 flex-1">
        <GraphSurface key={n} entityCount={n} />
      </div>

      <GraphDetail selection={selection} />

      {!import.meta.env.PROD && (
        <div className="fixed bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 border-2 border-fuchsia-500 bg-zinc-900 px-2 py-1 text-zinc-100 shadow-2xl">
          <span className="text-[10px] font-bold uppercase tracking-widest text-fuchsia-400">
            prototype
          </span>
          <select
            className="bg-zinc-800 px-1.5 py-0.5 text-xs"
            value={n}
            onChange={(event) => {
              void navigate({ search: { n: Number(event.target.value) } });
            }}
            aria-label="Entity count"
          >
            {ENTITY_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count.toLocaleString('en-GB')} entities
              </option>
            ))}
          </select>
          {cost !== '' && (
            <span className="max-w-[34rem] truncate text-[10px] text-zinc-400" title={cost}>
              {cost}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The sidebar column, at one fixed width whatever it holds, so that the canvas never changes size
 * and Sigma never has to re-measure.
 *
 * Two cases the sidebar of `features/detail/` cannot take, and both are findings and not faults:
 * a synthetic node, because that feature reads the fixture and the rows of the inflater are not
 * in it; and a relation, because that surface draws one entity.
 */
function GraphDetail({ selection }: { selection: GraphSelectionDetail | null }) {
  const entity =
    selection !== null && selection.kind === 'entity' ? findEntity(selection.id) : undefined;

  if (entity !== undefined && selection !== null) {
    return <DetailSidebar entityId={selection.id} />;
  }

  return (
    <aside className="w-[24rem] shrink-0 overflow-y-auto border-l border-border bg-sidebar p-3 text-sm text-sidebar-foreground">
      {selection === null ? (
        <p className="text-muted-foreground">
          Select a node, on the canvas or in the rail. The canvas never moves the camera, so the
          picture you learned stays where it is.
        </p>
      ) : selection.kind === 'relation' ? (
        <p className="text-muted-foreground">
          A relation is selected. The detail surface of <code>features/detail</code> draws one
          entity, so it cannot show this one. That is reported to the tracker, and not worked around
          here.
        </p>
      ) : (
        <p className="text-muted-foreground">
          This node comes from the inflater of this prototype, and not from{' '}
          <code>shared/fixtures/corpus</code>. The detail sidebar reads the fixture, so it has
          nothing to show.
        </p>
      )}
    </aside>
  );
}
