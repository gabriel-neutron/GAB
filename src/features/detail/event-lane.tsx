import { strikeCount } from '@gab/release/event-lane';

import { EmptyState } from '@/shared/page/empty-state';
import { PageSection } from '@/shared/page/page-section';
import { READING_LINK } from '@/shared/page/reading-link';
import { safeHref } from '@/shared/page/safe-href';

import { entityHref } from './address';
import type { EventLine } from './release-facts';

export interface EventLaneProps {
  readonly events: readonly EventLine[];
}

function DocumentName({ source }: { readonly source: EventLine['event']['documents'][number] }) {
  const href = source.address === null ? null : safeHref(source.address);
  if (href === null) return <span>{source.title}</span>;
  return (
    <a className={READING_LINK} href={href} rel="noreferrer">
      {source.title}
    </a>
  );
}

function EventItem({ line }: { readonly line: EventLine }) {
  const { event, actorKnown } = line;
  const { actor } = event;
  const stored =
    event.days.length === 0
      ? 'No day stored.'
      : `Stored as ${event.precision ?? 'day'}: ${event.days.join(', ')}.`;
  return (
    <li className="flex flex-col gap-0.5 border-l border-border pl-3">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{event.kind ?? 'Kind not stored'}</span>
        <span>
          {event.written === null ? 'The source gives no words for the day.' : `“${event.written}”`}
        </span>
        <span className="font-mono tabular-nums">{stored}</span>
      </p>
      <p>
        {actor === null ? (
          'No actor stored.'
        ) : (
          <>
            Claimed by{' '}
            {actorKnown ? (
              <a className={READING_LINK} href={entityHref(actor.id, null)}>
                {actor.label}
              </a>
            ) : (
              actor.label
            )}
            .
          </>
        )}
      </p>
      <p>
        Documents:{' '}
        {event.documents.length === 0
          ? 'none stored.'
          : event.documents.map((source, index) => (
              <span key={source.documentId}>
                {index === 0 ? '' : ', '}
                <DocumentName source={source} />
              </span>
            ))}
      </p>
      {event.denials.length === 0 ? (
        <p className="text-muted-foreground">Counter-statement: no counter-statement stored.</p>
      ) : (
        event.denials.map(({ claim, source, passage }, index) => (
          <figure key={`${claim.id} ${source.documentId} ${String(index)}`}>
            <blockquote className="max-w-prose bg-muted px-3 py-2">{passage.excerpt}</blockquote>
            <figcaption className="text-xs/5 text-muted-foreground">
              Counter-statement in <DocumentName source={source} />, page {passage.page}.
            </figcaption>
          </figure>
        ))
      )}
    </li>
  );
}

/** The events that a party claimed about one site, and a counter of the claimed strikes that the
 * release stores. The counter is a lower bound, and the page says so. */
export function EventLane({ events }: EventLaneProps) {
  const strikes = strikeCount(events.map((line) => line.event));
  return (
    <PageSection title="Events">
      <p>
        {strikes === 0
          ? 'No claimed strike is stored for this site.'
          : `At least ${String(strikes)} claimed and stored ${strikes === 1 ? 'strike' : 'strikes'}.`}
      </p>
      <p className="max-w-prose text-muted-foreground">
        The count holds only the strikes that a party claimed and that this registry stored from the
        documents it read. Other strikes can exist. It is not a count of all strikes.
      </p>
      {events.length === 0 ? (
        <EmptyState sentence="The release holds no event for this site." />
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((line) => (
            <EventItem key={line.event.id} line={line} />
          ))}
        </ul>
      )}
    </PageSection>
  );
}
