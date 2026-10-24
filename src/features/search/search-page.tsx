import { cn } from '@/shared/lib/utils';
import { DataTable, type DataColumn } from '@/shared/page/data-table';
import { EmptyState } from '@/shared/page/empty-state';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { Input } from '@/shared/ui/input';
import { keyWords } from '@gab/proposal/key-words';
import { typeLabel } from '@/shared/type-label';

import { MarkedText } from './marked-text';
import type { AttributeHit, AttributeSearchAnswer } from './attribute-search';
import type { DocumentHit, DocumentSearchAnswer } from './document-search';
import type { NameHit, NameSearchAnswer } from './name-search';

/** The three answers to one query. */
export interface SearchAnswers {
  readonly name: NameSearchAnswer;
  readonly attribute: AttributeSearchAnswer;
  readonly document: DocumentSearchAnswer;
}

interface SearchPageProps {
  readonly query: string;
  readonly answers: SearchAnswers;
  readonly onQueryChange: (query: string) => void;
  readonly hrefOf: (entityId: string) => string;
}

const FIELD_ID = 'search-by-name';
const HELP_ID = 'search-help';

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

interface AnswerProps<Row> {
  readonly name: string;
  readonly summary: string;
  readonly columns: readonly DataColumn<Row>[];
  readonly rows: readonly { readonly id: string; readonly row: Row }[];
}

// A status line says the count in words, and a table holds the rows. An answer with no row says
// its one sentence in place of the table, and the sentence is also a status.
function Answer<Row>({ name, summary, columns, rows }: AnswerProps<Row>) {
  return rows.length === 0 ? (
    <div role="status">
      <EmptyState sentence={summary} />
    </div>
  ) : (
    <>
      <p role="status" className="text-label">
        {summary}
      </p>
      <DataTable name={name} columns={columns} rows={rows} empty={summary} />
    </>
  );
}

const hitsOf = <Hit,>(
  answer: { readonly kind: string; readonly hits?: readonly Hit[] },
  idOf: (hit: Hit) => string,
): readonly { readonly id: string; readonly row: Hit }[] =>
  (answer.hits ?? []).map((hit) => ({ id: idOf(hit), row: hit }));

/** The reading page of a search: the field, then the three answers. The caller gives the frame
 * of the page, so it can place the controls that write beside the title. */
export function SearchPage({ query, answers, onQueryChange, hrefOf }: SearchPageProps) {
  const nameColumns: readonly DataColumn<NameHit>[] = [
    {
      key: 'name',
      header: 'Entity',
      cell: (hit) => (
        <a href={hrefOf(hit.entityId)} className={READING_LINK}>
          <MarkedText text={hit.label} query={query} />
        </a>
      ),
    },
    { key: 'type', header: 'Type', cell: (hit) => typeLabel(hit.type) },
  ];
  const attributeColumns: readonly DataColumn<AttributeHit>[] = [
    {
      key: 'entity',
      header: 'Entity',
      cell: (hit) => (
        <a href={hrefOf(hit.entityId)} className={READING_LINK}>
          {hit.label}
        </a>
      ),
    },
    { key: 'attribute', header: 'Attribute', cell: (hit) => keyWords(hit.key).label },
    { key: 'value', header: 'Value', cell: (hit) => <MarkedText text={hit.value} query={query} /> },
  ];
  const documentColumns: readonly DataColumn<DocumentHit>[] = [
    {
      key: 'title',
      header: 'Title',
      cell: (hit) =>
        hit.uri === null ? (
          <MarkedText text={hit.title} query={query} />
        ) : (
          <a href={hit.uri} className={READING_LINK}>
            <MarkedText text={hit.title} query={query} />
          </a>
        ),
    },
    { key: 'type', header: 'Type', cell: (hit) => hit.type },
    { key: 'host', header: 'Host', cell: (hit) => hit.host },
    { key: 'kind', header: 'Kind', cell: (hit) => hit.kind },
  ];

  return (
    <>
      <div className="flex max-w-prose flex-col gap-1">
        <label htmlFor={FIELD_ID} className="text-xs/5 text-label">
          Search names, values and documents
        </label>
        <Input
          id={FIELD_ID}
          type="search"
          autoFocus
          autoComplete="off"
          aria-describedby={HELP_ID}
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
          }}
          className={cn('rounded-none duration-100')}
        />
        <p id={HELP_ID} className="text-xs/5 text-label">
          Example: ledger. The field matches part of an entity name, of an attribute value and of a
          document title. Case and accents do not count. The matched text shows in each row.
        </p>
      </div>

      {answers.name.kind === 'no-query' ? null : (
        <PageSection title="Entity names">
          <Answer
            name="Entity names"
            summary={nameSummaryOf(answers.name)}
            columns={nameColumns}
            rows={hitsOf(answers.name, (hit) => hit.entityId)}
          />
        </PageSection>
      )}
      {answers.attribute.kind === 'no-query' ? null : (
        <PageSection title="Attribute values">
          <Answer
            name="Attribute values"
            summary={attributeSummaryOf(answers.attribute)}
            columns={attributeColumns}
            rows={hitsOf(answers.attribute, (hit) => `${hit.entityId}:${hit.key}`)}
          />
        </PageSection>
      )}
      {answers.document.kind === 'no-query' ? null : (
        <PageSection title="Documents">
          <Answer
            name="Documents"
            summary={documentSummaryOf(answers.document)}
            columns={documentColumns}
            rows={hitsOf(answers.document, (hit) => hit.documentId)}
          />
        </PageSection>
      )}
    </>
  );
}
