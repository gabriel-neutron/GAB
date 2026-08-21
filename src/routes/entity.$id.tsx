import { createFileRoute, notFound } from '@tanstack/react-router';
import { DetailPage } from '@/features/detail/detail-page';
import { readDossier } from '@/features/detail/dossier';
import { corpus } from '@/shared/fixtures/corpus';
import type { DocId } from '@/shared/fixtures/types';

export interface EntitySearch {
  /** The document the reader arrived at. `null` is the normal arrival. */
  readonly src: DocId | null;
}

// `notFound({ throw: true })` is the documented alternative to `throw notFound()`, used because
// the value TanStack Router raises is not an `Error` and `only-throw-error` stays on. Its return
// type is `NotFoundError` and not `never`, so this wrapper states `never` once.
function entityNotFound(): never {
  notFound({ throw: true });
  throw new Error('The router did not raise the not-found answer.');
}

export const Route = createFileRoute('/entity/$id')({
  // The address comes from outside, so it is validated before its first use. It falls back and
  // it never throws: a stale or a malformed `?src=` opens the page at no card, which is the
  // normal arrival, and it must never take the whole entity off the screen.
  validateSearch: (search: Record<string, unknown>): EntitySearch => {
    const src = search['src'];
    return { src: typeof src === 'string' && src.trim() !== '' ? src : null };
  },

  loader: ({ params }) => {
    if (params.id.trim() === '') entityNotFound();
    // `$id` is an opaque string: no schema is settled, so this file states no form for it. The one
    // exception above is a blank segment, which names no entity under any schema. `readDossier`
    // takes the corpus as an argument, so the day the read layer exists only that argument changes.
    return readDossier(corpus, params.id) ?? entityNotFound();
  },

  component: EntityRoute,
  notFoundComponent: EntityNotFound,

  // The identifier is in the title. Four routes that all report "Gabriel" tell a screen reader
  // nothing, and an entity page is the one route where the name changes on every visit.
  head: ({ params }) => ({ meta: [{ title: `Entity ${params.id} · Gabriel` }] }),
});

function EntityRoute() {
  const { id } = Route.useParams();
  const { src } = Route.useSearch();
  const dossier = Route.useLoaderData();

  // The defect this key exists to not repeat: every control is read-only and draws its value with
  // `defaultValue`, which React reads once. A move from one entity to another keeps the same
  // mounted page, so a field kept the previous entity's value under the correct label.
  return <DetailPage key={id} dossier={dossier} arrivedAtSource={src} />;
}

function EntityNotFound() {
  return (
    <p>
      No entity carries this identifier. The document that held it may have been withdrawn, so the
      link that brought you here may be stale.
    </p>
  );
}
