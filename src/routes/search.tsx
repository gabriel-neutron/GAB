import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { entityHref } from '@/features/detail/address';
import { UploadDocumentDialog } from '@/features/ingest/upload-document-dialog';
import { searchByAttributeValue } from '@/features/search/attribute-search';
import { searchByDocument } from '@/features/search/document-search';
import { searchByName } from '@/features/search/name-search';
import { SearchPage } from '@/features/search/search-page';
import { keepLastQuery, readLastQuery } from '@/features/search/workspace';
import { loadCorpus, refreshCorpus } from '@/shared/read/corpus';
import { loadProviders } from '@/shared/read/providers';

const pageOf = (entityId: string): string => entityHref(entityId, null);

export const Route = createFileRoute('/search')({
  loader: async () => {
    const [corpus, providers] = await Promise.all([loadCorpus(), loadProviders()]);
    return { corpus, providers };
  },
  component: SearchRoute,
  head: () => ({ meta: [{ title: 'Search · Gabriel' }] }),
});

function SearchRoute() {
  const { corpus, providers } = Route.useLoaderData();
  const router = useRouter();
  const [query, setQuery] = useState(readLastQuery);
  const nameAnswer = useMemo(() => searchByName(corpus.entities, query), [corpus, query]);
  const attributeAnswer = useMemo(
    () => searchByAttributeValue(corpus.entities, query),
    [corpus, query],
  );
  const documentAnswer = useMemo(() => searchByDocument(corpus.documents, query), [corpus, query]);

  // The documents are searched on this page, so a new document is uploaded from it. The search
  // feature and the ingest feature meet here and nowhere else.
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 justify-end border-b border-border p-2">
        <UploadDocumentDialog
          providers={providers}
          onStored={() => refreshCorpus(() => router.invalidate())}
        />
      </div>
      <div className="min-h-0 flex-1">
        <SearchPage
          query={query}
          nameAnswer={nameAnswer}
          attributeAnswer={attributeAnswer}
          documentAnswer={documentAnswer}
          onQueryChange={(next) => {
            setQuery(next);
            keepLastQuery(next);
          }}
          hrefOf={pageOf}
        />
      </div>
    </div>
  );
}
