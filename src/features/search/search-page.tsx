import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';

import type { AttributeSearchAnswer } from './attribute-search';
import type { DocumentSearchAnswer } from './document-search';
import type { NameSearchAnswer } from './name-search';

export interface SearchPageProps {
  readonly query: string;
  readonly nameAnswer: NameSearchAnswer;
  readonly attributeAnswer: AttributeSearchAnswer;
  readonly documentAnswer: DocumentSearchAnswer;
  readonly onQueryChange: (query: string) => void;
  readonly hrefOf: (entityId: string) => string;
}

const FIELD_ID = 'search-by-name';

const LINK = 'flex items-baseline gap-2 px-2 py-1.5 text-sm outline-none';
const LINK_STATE = 'hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50';
const LIST = 'divide-y divide-border border-y border-border';

const nameSummaryOf = (answer: NameSearchAnswer): string => {
  switch (answer.kind) {
    case 'no-query':
      return `Type a part of a name. The corpus holds ${answer.entityCount} ${answer.entityCount === 1 ? 'entity' : 'entities'}.`;
    case 'no-match':
      return `No entity name holds "${answer.query}".`;
    case 'matches':
      return `${answer.hits.length} ${answer.hits.length === 1 ? 'entity name holds' : 'entity names hold'} "${answer.query}".`;
  }
};

const attributeSummaryOf = (answer: AttributeSearchAnswer): string => {
  switch (answer.kind) {
    case 'no-query':
      return 'Type a part of a value to search the attributes.';
    case 'no-match':
      return `No attribute value holds "${answer.query}".`;
    case 'matches':
      return `${answer.hits.length} ${answer.hits.length === 1 ? 'attribute holds' : 'attributes hold'} "${answer.query}".`;
  }
};

const documentSummaryOf = (answer: DocumentSearchAnswer): string => {
  switch (answer.kind) {
    case 'no-query':
      return 'Type a part of a title to search the documents.';
    case 'no-match':
      return `No document title holds "${answer.query}".`;
    case 'matches':
      return `${answer.hits.length} ${answer.hits.length === 1 ? 'document title holds' : 'document titles hold'} "${answer.query}".`;
  }
};

export function SearchPage({
  query,
  nameAnswer,
  attributeAnswer,
  documentAnswer,
  onQueryChange,
  hrefOf,
}: SearchPageProps) {
  return (
    <div className="h-full overflow-y-auto">
      <section aria-labelledby="search-heading" className="mx-auto max-w-2xl space-y-6 p-4">
        <div className="space-y-3">
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
        </div>

        <div className="space-y-1">
          <p role="status" className="text-xs text-label">
            {nameSummaryOf(nameAnswer)}
          </p>
          {nameAnswer.kind === 'matches' ? (
            <ul aria-label="Matches" className={LIST}>
              {nameAnswer.hits.map((hit) => (
                <li key={hit.entityId}>
                  <a href={hrefOf(hit.entityId)} className={cn(LINK, LINK_STATE)}>
                    <span className="min-w-0 truncate">{hit.label}</span>
                    <span className="ml-auto shrink-0 text-xs text-label">{hit.type}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="space-y-1">
          <h2 className="text-xs text-label">Attribute values</h2>
          <p role="status" className="text-xs text-label">
            {attributeSummaryOf(attributeAnswer)}
          </p>
          {attributeAnswer.kind === 'matches' ? (
            <ul aria-label="Attribute matches" className={LIST}>
              {attributeAnswer.hits.map((hit) => (
                <li key={`${hit.entityId}:${hit.key}`}>
                  <a href={hrefOf(hit.entityId)} className={cn(LINK, LINK_STATE)}>
                    <span className="min-w-0 truncate">{hit.label}</span>
                    <span className="shrink-0 text-xs text-label">{hit.key}</span>
                    <span className="ml-auto min-w-0 shrink truncate text-xs">{hit.value}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="space-y-1">
          <h2 className="text-xs text-label">Documents</h2>
          <p role="status" className="text-xs text-label">
            {documentSummaryOf(documentAnswer)}
          </p>
          {documentAnswer.kind === 'matches' ? (
            <ul aria-label="Document matches" className={LIST}>
              {documentAnswer.hits.map((hit) =>
                hit.uri === null ? (
                  <li key={hit.documentId} className={cn(LINK, 'text-label')}>
                    <span className="min-w-0 truncate">{hit.title}</span>
                    <span className="ml-auto shrink-0 text-xs">{hit.kind}</span>
                  </li>
                ) : (
                  <li key={hit.documentId}>
                    <a href={hit.uri} className={cn(LINK, LINK_STATE)}>
                      <span className="min-w-0 truncate">{hit.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-label">{hit.kind}</span>
                    </a>
                  </li>
                ),
              )}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
