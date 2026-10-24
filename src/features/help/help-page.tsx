import { SEEDED_RELATION_TYPES } from '@gab/proposal/relation-types';

import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { ReadingPage } from '@/shared/page/reading-page';

import { GLOSSARY_TERMS } from './glossary-terms';

/** The page of help: how to read a fact, then the glossary. The relation types come from the
 * vocabulary, so the page and the sidebar give the same definition. */
export function HelpPage() {
  return (
    <ReadingPage>
      <PageHeader
        title="Help and glossary"
        detail="How to read the record, and what its words mean"
      />
      <PageSection title="How to read a fact" id="reading">
        <ul className="flex max-w-prose list-disc flex-col gap-1 pl-4">
          <li>Each fact cites a document. Open the source of a fact to read the document.</li>
          <li>
            A fact in review is a proposal. The page marks it as a proposal, and it is not yet a
            fact of the record.
          </li>
          <li>A date that is not shown is a date that the record does not hold.</li>
        </ul>
      </PageSection>
      <PageSection title="Words of the record" id="terms">
        <dl className="flex max-w-prose flex-col gap-2">
          {GLOSSARY_TERMS.map(({ term, definition }) => (
            <div key={term}>
              <dt className="font-semibold">{term}</dt>
              <dd>{definition}</dd>
            </div>
          ))}
        </dl>
      </PageSection>
      <PageSection title="Relation types" id="relations">
        <dl className="flex max-w-prose flex-col gap-2">
          {SEEDED_RELATION_TYPES.map((type) => (
            <div key={type.key}>
              <dt className="font-semibold break-words">
                {type.label} <span className="font-normal text-label">/ {type.inverseLabel}</span>
              </dt>
              <dd>{type.definition}</dd>
            </div>
          ))}
        </dl>
      </PageSection>
    </ReadingPage>
  );
}
