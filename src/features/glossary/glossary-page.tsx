import { SEEDED_RELATION_TYPES } from '@gab/proposal/relation-types';

import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { ReadingPage } from '@/shared/page/reading-page';

const PROSE = 'max-w-prose';

interface Term {
  readonly id: string;
  readonly name: string;
  readonly meaning: string;
}

const TERMS: readonly Term[] = [
  {
    id: 'hostile',
    name: 'Hostile',
    meaning:
      'The affiliation of a unit, such as Hostile, is the point of view of the project. It is not a legal finding. A source states it, and the page of a unit names that source.',
  },
  {
    id: 'claims',
    name: 'Claims',
    meaning:
      'A claim is one fact that the record holds about an entity or a relation. Each claim cites at least one source document.',
  },
  {
    id: 'pending-proposals',
    name: 'Pending proposals',
    meaning:
      'A proposal is a change that a machine or a person suggests. It is pending until the operator decides it. A pending proposal is not part of the record.',
  },
];

/** The glossary: the words of the interface that a reader can mistake, and each relation type
 * with its definition. The relation types come from the one list that the application and the
 * site both read. */
export function GlossaryPage() {
  return (
    <ReadingPage>
      <PageHeader title="Glossary" />

      <PageSection title="Terms">
        <dl className={`${PROSE} flex flex-col gap-3`}>
          {TERMS.map((term) => (
            <div key={term.id} id={term.id} className="flex flex-col gap-0.5">
              <dt className="font-medium">{term.name}</dt>
              <dd>{term.meaning}</dd>
            </div>
          ))}
        </dl>
      </PageSection>

      <PageSection title="Relation types" id="relation-types">
        <dl className={`${PROSE} flex flex-col gap-3`}>
          {SEEDED_RELATION_TYPES.map((type) => (
            <div key={type.key} data-relation-type={type.key} className="flex flex-col gap-0.5">
              <dt className="font-medium">
                {type.label}
                {type.inverseLabel === type.label ? null : (
                  <span className="font-normal text-label">{`, from the other end: ${type.inverseLabel}`}</span>
                )}
              </dt>
              <dd>{type.definition}</dd>
            </div>
          ))}
        </dl>
      </PageSection>
    </ReadingPage>
  );
}
