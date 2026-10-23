import { createFileRoute, Link, useRouter } from '@tanstack/react-router';

import { useMemo, useState } from 'react';

import { entityHref } from '@/features/detail/address';

import { LeadDialog } from '@/features/ingest/lead-dialog';

import { UploadDocumentDialog } from '@/features/ingest/upload-document-dialog';

import { searchByAttributeValue } from '@/features/search/attribute-search';

import { searchByDocument } from '@/features/search/document-search';

import { searchByName } from '@/features/search/name-search';

import { SearchPage } from '@/features/search/search-page';

import { keepLastQuery, readLastQuery } from '@/features/search/workspace';

import { CoverageStatement } from '@/shared/page/coverage-statement';

import { ReadingPage } from '@/shared/page/reading-page';

import { loadCorpus, refreshCorpus } from '@/shared/read/corpus';

import { loadProviders } from '@/shared/read/providers';

import { readMode } from '@/shared/read/read-mode';

import { loadReleaseOrNull } from '@/shared/read/release-record';

import { useReleaseNote } from '@/shared/read/release-note';

import { useWriterOnline } from '@/shared/write/writer-status';

import { coverageOf } from '@gab/release/coverage';

const pageOf = (entityId: string): string => entityHref(entityId, null);

export const Route = createFileRoute('/search')({
  loader: async () => {
    const [corpus, providers] = await Promise.all([loadCorpus(), loadProviders()]);

    // The files of a release describe only the documents that a claim cites, and the release

    // counts every document of the record. The page states the count of the release.

    const stated =
      readMode() === 'release'
        ? ((await loadReleaseOrNull().catch(() => null))?.manifest.coverage ?? null)
        : null;

    return { corpus, providers, stated };
  },

  component: SearchRoute,

  head: () => ({ meta: [{ title: 'Search · GAB dataset' }] }),
});

function SearchRoute() {
  const { corpus, providers, stated } = Route.useLoaderData();

  const router = useRouter();

  const writerOnline = useWriterOnline();

  const releaseNote = useReleaseNote();

  const [query, setQuery] = useState(readLastQuery);

  const coverage = useMemo(
    () =>
      stated ??
      coverageOf(
        corpus.entities.map((one) => one.type),

        corpus.documents.length,
      ),

    [corpus, stated],
  );

  const name = useMemo(() => searchByName(corpus.entities, query), [corpus, query]);

  const attribute = useMemo(() => searchByAttributeValue(corpus.entities, query), [corpus, query]);

  const document = useMemo(() => searchByDocument(corpus.documents, query), [corpus, query]);

  // The documents are searched on this page, so a new document is uploaded and a lead is given

  // from it. The search feature and the ingest feature meet here and nowhere else. Where no write

  // service answers, the two controls are not drawn.

  const actions = writerOnline ? (
    <>
      <LeadDialog />

      <UploadDocumentDialog
        providers={providers}

        onStored={() => refreshCorpus(() => router.invalidate())}
      />
    </>
  ) : undefined;

  return (
    <ReadingPage>
      <h1 className="sr-only">Données</h1>
      {actions === undefined ? null : (
        <div className="flex flex-wrap justify-end gap-2">{actions}</div>
      )}

      <SearchPage
        query={query}

        answers={{ name, attribute, document }}

        onQueryChange={(next) => {
          setQuery(next);

          keepLastQuery(next);
        }}

        hrefOf={pageOf}
      />

      <Link to="/downloads" className="text-small underline underline-offset-4">
        Télécharger les données
      </Link>

      <details className="border-t border-border pt-2">
        <summary className="cursor-pointer text-label">Périmètre des données</summary>

        <div className="pt-3">
          <CoverageStatement
            coverage={coverage}

            release={
              releaseNote === null ? null : { version: releaseNote.version, date: releaseNote.date }
            }
          />
        </div>
      </details>
    </ReadingPage>
  );
}
