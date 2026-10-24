import {
  createFileRoute,
  notFound,
  redirect,
  stripSearchParams,
  useRouter,
} from '@tanstack/react-router';
import { DetailPage } from '@/features/detail/detail-page';
import { readDossier, type Dossier } from '@/features/detail/dossier';
import { releaseFactsOf } from '@/features/detail/release-facts';
import { PageHeader } from '@/shared/page/page-header';
import { ReadingPage } from '@/shared/page/reading-page';
import { loadCorpus, refreshCorpus } from '@/shared/read/corpus';
import { loadDecidedActs } from '@/shared/read/decided-acts';
import type { DocId } from '@/shared/read/model';
import { readMode } from '@/shared/read/read-mode';
import { loadReleaseOrNull } from '@/shared/read/release-record';
import { loadEntityTypes } from '@/shared/read/vocabulary';
import { typeLabel } from '@/shared/type-label';

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

// The same wrapper as above, for the same reason: `redirect({ throw: true })` does not return
// `never` in its type.
function goToSurvivor(id: string, src: string | null): never {
  redirect({
    to: '/entity/$id',
    params: { id },
    search: { src },
    replace: true,
    throw: true,
  });
  throw new Error('The router did not raise the redirect.');
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

  loaderDeps: ({ search }) => ({ src: search.src }),

  loader: async ({ params, deps }): Promise<Dossier> => {
    if (params.id.trim() === '') entityNotFound();
    // `$id` is an opaque string: no schema is settled, so this file states no form for it. The one
    // exception above is a blank segment, which names no entity under any schema. The read API
    // answers the whole corpus, and the router holds this page back until that answer arrives.
    const [corpus, types] = await Promise.all([loadCorpus(), loadEntityTypes()]);
    // Only the act that promoted this entity is read, so the entity is found first.
    const promotedFrom = corpus.entities.find((one) => one.id === params.id)?.promotedFrom;
    const decided = promotedFrom === undefined ? [] : await loadDecidedActs(promotedFrom);
    const dossier = readDossier(corpus, params.id, types, decided);
    // The release only adds to a live page, so a release that cannot be read costs the page its
    // extra lines and nothing more. In release mode the corpus read has failed already.
    const release = await loadReleaseOrNull().catch(() => null);
    if (dossier === null) {
      // An identifier that a merge absorbed opens the page of the entity that survived it.
      const survivor = release?.aliases.get(params.id);
      if (survivor === undefined || survivor === params.id) return entityNotFound();
      return goToSurvivor(survivor, deps.src);
    }
    return {
      ...dossier,
      facts:
        release === null
          ? null
          : releaseFactsOf(release, dossier.entityId, dossier.type, readMode() === 'release'),
    };
  },

  component: EntityRoute,
  notFoundComponent: EntityNotFound,

  // The name of the entity is in the title. Four routes that all report the name of the dataset
  // tell a screen reader nothing, and an entity page is the one route where the name changes on
  // every visit. An entity that is absent keeps its identifier.
  head: ({ params, loaderData }) => ({
    meta: [
      { title: `${loaderData?.label ?? `Entity ${params.id}`} · GAB dataset` },
      {
        name: 'description',
        content:
          loaderData === undefined
            ? 'An entity of the GAB dataset, with its claims, relations and sources.'
            : `${loaderData.label}, ${typeLabel(loaderData.type).toLowerCase()}: its claims, relations and the documents that state them, in the GAB dataset.`,
      },
    ],
  }),
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
    <ReadingPage>
      <PageHeader title="Entity not found" />
      <p className="max-w-prose">
        No entity carries this identifier. The document that held it may have been withdrawn, so the
        link that brought you here may be stale.
      </p>
    </ReadingPage>
  );
}
