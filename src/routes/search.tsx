import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { entityHref } from '@/features/detail/address';
import { LeadDialog } from '@/features/ingest/lead-dialog';
import { UploadDocumentDialog } from '@/features/ingest/upload-document-dialog';
import { searchByAttributeValue } from '@/features/search/attribute-search';
import { searchByDocument } from '@/features/search/document-search';
import { searchByName } from '@/features/search/name-search';
import { SearchPage } from '@/features/search/search-page';
import { keepLastQuery, readLastQuery } from '@/features/search/workspace';
import { PageHeader } from '@/shared/page/page-header';
import { ReadingPage } from '@/shared/page/reading-page';
import { loadCorpus, refreshCorpus } from '@/shared/read/corpus';
import { loadProviders } from '@/shared/read/providers';
import { useReleaseNote } from '@/shared/read/release-note';
import { useWriterOnline } from '@/shared/write/writer-status';
import { releaseDay } from '@gab/release/release-day';

const pageOf = (entityId: string): string => entityHref(entityId, null);

export const Route = createFileRoute('/search')({
  loader: async () => {
    const [corpus, providers] = await Promise.all([loadCorpus(), loadProviders()]);
    return { corpus, providers };
  },
  component: SearchRoute,
  head: () => ({ meta: [{ title: 'Search · GAB dataset' }] }),
});

function SearchRoute() {
  const { corpus, providers } = Route.useLoaderData();
  const router = useRouter();
  const writerOnline = useWriterOnline();
  const releaseNote = useReleaseNote();
  const [query, setQuery] = useState(readLastQuery);
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
  const detail =
    releaseNote === null ? undefined : `From the release of ${releaseDay(releaseNote.date)}`;

  return (
    <ReadingPage>
      <PageHeader
        title="Search"
        {...(detail === undefined ? {} : { detail })}
        {...(actions === undefined ? {} : { actions })}
      />
      <SearchPage
        query={query}
        answers={{ name, attribute, document }}
        onQueryChange={(next) => {
          setQuery(next);
          keepLastQuery(next);
        }}
        hrefOf={pageOf}
      />
    </ReadingPage>
  );
}
