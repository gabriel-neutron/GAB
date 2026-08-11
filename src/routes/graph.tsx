import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ENTITY_COUNTS, GRAPH_VARIANTS } from '@/features/graph/prototype-variants';
import { PrototypeSwitcher } from '@/shared/prototype-switcher';

// PROTOTYPE. The route owns the two search parameters and the variant bar, and the feature owns
// nothing but the canvas. That split is not cosmetic: a search parameter is React state, and
// ADR 0004 §3 refuses React state inside `features/graph/`.
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

  const entry = GRAPH_VARIANTS.find((candidate) => candidate.key === variant) ?? GRAPH_VARIANTS[0];
  if (entry === undefined) return null;
  const Variant = entry.Component;

  return (
    <div className="h-[calc(100svh-6.5rem)] w-full">
      <Variant key={`${entry.key}-${n}`} entityCount={n} />
      <PrototypeSwitcher
        options={GRAPH_VARIANTS}
        current={entry.key}
        onChange={(key) => {
          void navigate({ search: { variant: key, n } });
        }}
        extra={
          <select
            className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs"
            value={n}
            onChange={(event) => {
              void navigate({ search: { variant: entry.key, n: Number(event.target.value) } });
            }}
            aria-label="Entity count"
          >
            {ENTITY_COUNTS.map((count) => (
              <option key={count} value={count}>
                {count.toLocaleString('en-GB')} entities
              </option>
            ))}
          </select>
        }
      />
    </div>
  );
}
