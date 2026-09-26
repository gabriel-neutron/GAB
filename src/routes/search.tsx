import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

import { entityHref } from '@/features/detail/address';
import { searchByName } from '@/features/search/name-search';
import { SearchPage } from '@/features/search/search-page';
import { keepLastQuery, readLastQuery } from '@/features/search/workspace';
import { loadCorpus } from '@/shared/read/corpus';

const pageOf = (entityId: string): string => entityHref(entityId, null);

export const Route = createFileRoute('/search')({
  loader: () => loadCorpus(),
  component: SearchRoute,
  head: () => ({ meta: [{ title: 'Search · Gabriel' }] }),
});

function SearchRoute() {
  const corpus = Route.useLoaderData();
  const [query, setQuery] = useState(readLastQuery);
  const answer = useMemo(() => searchByName(corpus.entities, query), [corpus, query]);

  return (
    <SearchPage
      query={query}
      answer={answer}
      onQueryChange={(next) => {
        setQuery(next);
        keepLastQuery(next);
      }}
      hrefOf={pageOf}
    />
  );
}
