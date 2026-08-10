import { createFileRoute, notFound } from '@tanstack/react-router';
import { DetailPage } from '@/features/detail/detail-page';

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
 */
export const Route = createFileRoute('/entity/$id')({
  loader: ({ params }) => {
    // `notFound({ throw: true })` is the documented alternative to `throw notFound()`. It is
    // used because the value that TanStack Router raises is not an `Error`, and this
    // repository keeps `only-throw-error` on with no exception.
    if (params.id.trim() === '') notFound({ throw: true });
  },
  component: DetailPage,
  notFoundComponent: EntityNotFound,
});

function EntityNotFound() {
  return (
    <p>
      No entity carries this identifier. The document that held it may have been withdrawn, so the
      link that brought you here may be stale.
    </p>
  );
}
