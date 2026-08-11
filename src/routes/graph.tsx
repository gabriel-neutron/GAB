import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { DetailSidebar } from '@/features/detail/detail-sidebar';
import { findEntity } from '@/features/detail/prototype-data';
import {
  onGraphCost,
  onGraphSelection,
  type GraphSelectionDetail,
} from '@/features/graph/prototype-bridge';
import { ENTITY_COUNTS, GRAPH_VARIANTS } from '@/features/graph/prototype-variants';
import { PrototypeSwitcher } from '@/shared/prototype-switcher';

/**
 * PROTOTYPE host for the graph.
 *
 * **The route owns the two search parameters and the composition.** That split is not cosmetic.
 * A search parameter is React state, and ADR 0004 §3 refuses React state inside
 * `features/graph/`; and ADR 0004 §5 refuses a feature that imports a feature, so the sidebar of
 * `features/detail/` can only be put beside the canvas here. `routes/entity.$id.tsx` says the
 * same thing from the other side, and calls its neighbour a placeholder until this file exists.
 *
 * The graph re-renders nothing when the selection changes. It arrives as a window event, this
 * component holds it, and `memo` on the variant means the canvas is never touched.
 */
export interface GraphSearch {
  readonly variant: string;
  readonly n: number;
}

export const Route = createFileRoute('/graph')({
  component: GraphRoute,
  head: () => ({ meta: [{ title: 'Graph · Gabriel' }] }),
  validateSearch: (search: Record<string, unknown>): GraphSearch => {
    const rawVariant = search['variant'];
    const variant =
      typeof rawVariant === 'string' && GRAPH_VARIANTS.some((entry) => entry.key === rawVariant)
        ? rawVariant
        : 'A';
    const rawCount = Number(search['n']);
    const n = ENTITY_COUNTS.includes(rawCount) ? rawCount : 10000;
    return { variant, n };
  },
});

function GraphRoute() {
  const { variant, n } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const [selection, setSelection] = useState<GraphSelectionDetail | null>(null);
  const [cost, setCost] = useState('');

  useEffect(() => onGraphSelection(setSelection), []);
  useEffect(() => onGraphCost(setCost), []);

  const entry = GRAPH_VARIANTS.find((candidate) => candidate.key === variant) ?? GRAPH_VARIANTS[0];
  if (entry === undefined) return null;
  const Variant = entry.Component;

  // Variant A draws no detail of its own, so the sidebar stands beside it. B and C carry their
  // own detail surface, and a second one would be two answers to one question.
  const withSidebar = entry.key === 'A';

  return (
    <div className="flex h-[calc(100svh-6.5rem)] w-full gap-3">
      <div className="min-w-0 flex-1">
        <Variant key={`${entry.key}-${n}`} entityCount={n} />
      </div>

      {withSidebar && <GraphDetail selection={selection} />}

      <PrototypeSwitcher
        options={GRAPH_VARIANTS}
        current={entry.key}
        onChange={(key) => {
          void navigate({ search: { variant: key, n } });
        }}
        extra={
          <>
            <select
              className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs"
              value={n}
              onChange={(event) => {
                void navigate({
                  search: { variant: entry.key, n: Number(event.target.value) },
                });
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
              <span className="max-w-[26rem] truncate text-[10px] text-zinc-400" title={cost}>
                {cost}
              </span>
            )}
          </>
        }
      />
    </div>
  );
}

/**
 * The sidebar column, at one fixed width whatever it holds, so that the canvas never changes size
 * and Sigma never has to re-measure.
 *
 * Two cases the sidebar of `features/detail/` cannot take, and both are findings and not faults:
 * a synthetic node, because that feature reads the fixture and the inflater's rows are not in it;
 * and a relation, because that surface draws one entity.
 */
function GraphDetail({ selection }: { selection: GraphSelectionDetail | null }) {
  const entity =
    selection !== null && selection.kind === 'entity' ? findEntity(selection.id) : undefined;

  if (entity !== undefined && selection !== null) {
    return <DetailSidebar entityId={selection.id} />;
  }

  // The same width and the same edge as the real sidebar, so the canvas never changes size and
  // Sigma is never asked to re-measure.
  return (
    <aside className="w-[24rem] shrink-0 overflow-y-auto border-l border-border bg-sidebar p-3 text-sm text-sidebar-foreground">
      {selection === null ? (
        <p className="text-muted-foreground">
          Select a node. The camera does not move, so the picture you learned stays where it is.
        </p>
      ) : selection.kind === 'relation' ? (
        <p className="text-muted-foreground">
          A relation is selected. The detail surface of <code>features/detail</code> draws one
          entity, so it cannot show this one. Reported to the tracker, not worked around here.
        </p>
      ) : (
        <p className="text-muted-foreground">
          This node comes from the inflater of this prototype, not from{' '}
          <code>shared/fixtures/corpus</code>. The detail sidebar reads the fixture, so it has
          nothing to show. Use <em>go to the fixture</em> for a node with a real row behind it.
        </p>
      )}
    </aside>
  );
}
