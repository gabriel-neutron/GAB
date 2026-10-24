import { Link } from '@tanstack/react-router';

import { PageHeader } from '@/shared/page/page-header';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';

const PROSE = 'max-w-prose';

/** The help page: how to start, where the words are defined, and how a fact is checked. */
export function HelpPage() {
  return (
    <ReadingPage>
      <PageHeader title="Help" />

      <PageSection title="Where to start">
        <ul className={`${PROSE} flex flex-col gap-1`}>
          <li>
            <Link to="/search" className={READING_LINK}>
              Search
            </Link>{' '}
            finds a name, a value or the title of a document.
          </li>
          <li>
            <Link to="/map" search={{ entity: '', relation: '' }} className={READING_LINK}>
              The map
            </Link>{' '}
            shows the assets that have a position, and the chain that joins them.
          </li>
          <li>
            <Link to="/graph" search={{ entity: '', relation: '' }} className={READING_LINK}>
              The graph
            </Link>{' '}
            shows the relations of one entity.
          </li>
        </ul>
      </PageSection>

      <PageSection title="The words of the interface">
        <p className={PROSE}>
          The{' '}
          <Link to="/glossary" className={READING_LINK}>
            glossary
          </Link>{' '}
          gives the meaning of each term that a reader can mistake, and of each type of relation.
        </p>
      </PageSection>

      <PageSection title="How the facts are checked">
        <div className={`${PROSE} flex flex-col gap-2`}>
          <p>
            Each fact cites at least one stored document, and the page of the fact shows the passage
            that supports it. A fact with no source is not accepted.
          </p>
          <p>
            A machine or a person can propose a fact. A proposal is not part of the record until it
            is decided. A fact that is still in review carries the words “In review”, and it is a
            proposal, not a fact.
          </p>
          <p>
            Each source and each fact has a rating. The{' '}
            <Link to="/method" className={READING_LINK}>
              method page
            </Link>{' '}
            explains the rating, the licences and the rules of the critical nodes.
          </p>
        </div>
      </PageSection>
    </ReadingPage>
  );
}
