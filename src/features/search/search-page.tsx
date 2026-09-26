import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';

import type { NameSearchAnswer } from './name-search';

export interface SearchPageProps {
  readonly query: string;
  readonly answer: NameSearchAnswer;
  readonly onQueryChange: (query: string) => void;
  readonly hrefOf: (entityId: string) => string;
}

const FIELD_ID = 'search-by-name';

const summaryOf = (answer: NameSearchAnswer): string => {
  switch (answer.kind) {
    case 'no-query':
      return `Type a part of a name. The corpus holds ${answer.entityCount} ${answer.entityCount === 1 ? 'entity' : 'entities'}.`;
    case 'no-match':
      return `No entity name holds "${answer.query}".`;
    case 'matches':
      return `${answer.hits.length} ${answer.hits.length === 1 ? 'entity name holds' : 'entity names hold'} "${answer.query}".`;
  }
};

export function SearchPage({ query, answer, onQueryChange, hrefOf }: SearchPageProps) {
  return (
    <div className="h-full overflow-y-auto">
      <section aria-labelledby="search-heading" className="mx-auto max-w-2xl space-y-3 p-4">
        <h1 id="search-heading" className="text-base">
          Search the corpus
        </h1>
        <div className="space-y-1">
          <label htmlFor={FIELD_ID} className="text-xs text-label">
            Entity name
          </label>
          <Input
            id={FIELD_ID}
            type="search"
            autoFocus
            autoComplete="off"
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
            }}
          />
        </div>
        <p role="status" className="text-xs text-label">
          {summaryOf(answer)}
        </p>
        {answer.kind === 'matches' ? (
          <ul aria-label="Matches" className="divide-y divide-border border-y border-border">
            {answer.hits.map((hit) => (
              <li key={hit.entityId}>
                <a
                  href={hrefOf(hit.entityId)}
                  className={cn(
                    'flex items-baseline gap-2 px-2 py-1.5 text-sm outline-none',
                    'hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
                  )}
                >
                  <span className="min-w-0 truncate">{hit.label}</span>
                  <span className="ml-auto shrink-0 text-xs text-label">{hit.type}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
