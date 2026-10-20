import { Link } from '@tanstack/react-router';

import { READING_LINK } from '@/shared/page/reading-link';
import { Button } from '@/shared/ui/button';

export interface FirstVisitCardProps {
  /** The reader closed the card. The caller keeps the answer. */
  readonly onClose: () => void;
}

/** The card of the first visit: the scope of the record and three ways to start. */
export function FirstVisitCard({ onClose }: FirstVisitCardProps) {
  return (
    <section
      aria-label="Start here"
      className="flex max-w-prose flex-col gap-2 border border-border px-2 py-2"
    >
      <p>
        This record holds sourced facts about the Russian oil and gas chain and its sanctions. Each
        fact cites a document. A fact in review is a proposal, and the page marks it as one.
      </p>
      <ul className="flex flex-col gap-1">
        <li>
          <Link to="/search" className={READING_LINK}>
            Search
          </Link>{' '}
          for a name, a value or a document.
        </li>
        <li>Use this map to see where the assets are and how the chain joins them.</li>
        <li>
          <Link to="/graph" search={{ entity: '', relation: '' }} className={READING_LINK}>
            Open the graph
          </Link>{' '}
          to follow the relations of one entity.
        </li>
      </ul>
      <p>
        A word that you do not know is in the{' '}
        <Link to="/glossary" className={READING_LINK}>
          glossary
        </Link>
        . The{' '}
        <Link to="/help" className={READING_LINK}>
          help page
        </Link>{' '}
        says how the facts are checked.
      </p>
      <div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close this card
        </Button>
      </div>
    </section>
  );
}
