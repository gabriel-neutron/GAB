import { createFileRoute, notFound } from '@tanstack/react-router';
import { DetailPage } from '@/features/detail/detail-page';
import { DetailSidebar } from '@/features/detail/detail-sidebar';
import { PrototypeSwitcher } from '@/features/detail/prototype-switcher';
import {
  parseSurface,
  parseVariant,
  type Surface,
  type VariantKey,
} from '@/features/detail/prototype-variants';

/**
 * `$id` is an opaque string. No schema is settled (`spec.md` §3), so this file decides nothing
 * about the form of an identifier — no length, no character set, no prefix.
 *
 * The one case it does answer is a segment that is blank once trimmed. A blank string names no
 * entity under any schema, so rejecting it settles nothing. Every other identifier reaches the
 * page. When the read layer exists (#26), this loader asks it, and throws the same `notFound`
 * when the answer is empty.
 *
 * The words below are not the words of an unknown path. An unknown identifier is usually a
 * stale link to a withdrawn document (#28), and a fuzzy match would hide that.
 *
 * **This route is a prototype host.** `?variant=` picks one of three layouts and `?surface=`
 * picks the full page or the sidebar. Both are scaffolding for the operator, and **neither is a
 * decision about #33**: a layout that wins loses its search parameter when it is folded in.
 */
export const Route = createFileRoute('/entity/$id')({
  loader: ({ params }) => {
    // `notFound({ throw: true })` is the documented alternative to `throw notFound()`. It is
    // used because the value that TanStack Router raises is not an `Error`, and this
    // repository keeps `only-throw-error` on with no exception.
    if (params.id.trim() === '') notFound({ throw: true });
  },

  // An unreadable value falls back and never throws. A prototype address is typed by hand.
  validateSearch: (search: Record<string, unknown>): { variant: VariantKey; surface: Surface } => ({
    variant: parseVariant(search['variant']),
    surface: parseSurface(search['surface']),
  }),

  component: DetailRoute,
  notFoundComponent: EntityNotFound,

  // The identifier is in the title. Four routes that all report "Gabriel" tell a screen reader
  // nothing, and an entity page is the one route where the name changes on every visit.
  head: ({ params }) => ({ meta: [{ title: `Entity ${params.id} · Gabriel` }] }),
});

/**
 * **The route composes.** ADR 0004 §5 refuses a feature that imports a feature, so the sidebar is
 * put beside its neighbour here and never inside `features/detail/`. The neighbour is a
 * placeholder: the real one is the map or the graph, and loading either would make this route
 * import a second feature, which is exactly what the seam forbids without a route to hold it.
 */
function DetailRoute() {
  const { id } = Route.useParams();
  const { variant, surface } = Route.useSearch();
  const navigate = Route.useNavigate();

  const onSelect = (nextVariantKey: VariantKey, nextSurface: Surface): void => {
    void navigate({ search: { variant: nextVariantKey, surface: nextSurface } });
  };

  return (
    <>
      {surface === 'page' ? (
        <DetailPage entityId={id} variant={variant} />
      ) : (
        <div className="flex h-[calc(100svh-8rem)] overflow-hidden rounded-lg border border-border">
          <div className="flex flex-1 items-center justify-center bg-muted/40 p-4 text-center text-sm text-muted-foreground">
            The map or the graph stands here. This prototype loads neither, so that the sidebar is
            judged on its own width and its own density.
          </div>
          <DetailSidebar entityId={id} variant={variant} />
        </div>
      )}
      <div className="h-16" />
      <PrototypeSwitcher variant={variant} surface={surface} onSelect={onSelect} />
    </>
  );
}

function EntityNotFound() {
  return (
    <p>
      No entity carries this identifier. The document that held it may have been withdrawn, so the
      link that brought you here may be stale.
    </p>
  );
}
