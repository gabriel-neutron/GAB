import type { MouseEvent } from 'react';
import { Link } from '@tanstack/react-router';

import { READING_LINK } from '@/shared/page/reading-link';
import { Button } from '@/shared/ui/button';

export interface FirstVisitCardProps {
  /** The reader closed the card. The caller keeps the answer. */
  readonly onClose: () => void;
}

/** The card of the first visit: the scope of the record and three ways to start. */
export function FirstVisitCard({ onClose }: FirstVisitCardProps) {
  // The card leaves the page with its focused button, so the focus moves to the page title first.
  // External constraint: a heading takes the focus only with a `tabindex`.
  const close = (event: MouseEvent<HTMLButtonElement>) => {
    const title = event.currentTarget.closest('section')?.parentElement?.querySelector('h1');
    title?.setAttribute('tabindex', '-1');
    title?.focus();
    onClose();
  };
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
        <Button type="button" variant="outline" size="sm" onClick={close}>
          Close this card
        </Button>
      </div>
    </section>
  );
}
