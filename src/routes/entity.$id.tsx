import { createFileRoute, notFound, stripSearchParams, useRouter } from '@tanstack/react-router';
import { DetailPage } from '@/features/detail/detail-page';
import { readDossier } from '@/features/detail/dossier';
import { loadCorpus, refreshCorpus } from '@/shared/read/corpus';
import type { DocId } from '@/shared/read/model';
import { loadVocabulary } from '@/shared/read/vocabulary';

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

  // The normal arrival names no document, and `null` reaches the address bar as the four
  // characters `null`, which is a document identifier that no corpus holds.
  search: { middlewares: [stripSearchParams({ src: null })] },

  loader: async ({ params }) => {
    if (params.id.trim() === '') entityNotFound();
    // `$id` is an opaque string: no schema is settled, so this file states no form for it. The one
    // exception above is a blank segment, which names no entity under any schema. The read API
    // answers the whole corpus, and the router holds this page back until that answer arrives.
    const [read, vocabulary] = await Promise.all([loadCorpus(), loadVocabulary()]);
    return readDossier(read, params.id, vocabulary) ?? entityNotFound();
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
  const router = useRouter();

  // A move to another entity keeps the same mounted page, and the key destroys it instead. A
  // draft belongs to the entity it was typed on, and it must never arrive on the next one.
  return (
    <DetailPage
      key={id}
      dossier={dossier}
      arrivedAtSource={src}
      onSaved={() => refreshCorpus(() => router.invalidate())}
      onDeleted={async () => {
        await router.navigate({ to: '/graph', search: { entity: '', relation: '' } });
        await refreshCorpus(() => router.invalidate());
      }}
    />
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
