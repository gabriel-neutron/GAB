import { claimText } from './claim-text.ts';
import { eventsAt, strikeCount, type SiteEvent } from './event-lane.ts';
import { safeHref } from './safe-href.ts';
import { claimPage, entityPage, hrefFrom, type SitePath } from './site-paths.ts';
import type { SiteRelease, SiteSource } from './site-release.ts';
import { LINK } from './site-style.ts';

export interface EventLaneProps {
  readonly release: SiteRelease;
  readonly siteId: string;
  readonly here: SitePath;
}

function DocumentName({ source }: { readonly source: SiteSource }) {
  const href = source.address === null ? null : safeHref(source.address);
  if (href === null) return <span>{source.title}</span>;
  return (
    <a className={LINK} href={href} rel="noreferrer">
      {source.title}
    </a>
  );
}

function EventItem({
  release,
  event,
  here,
}: {
  readonly release: SiteRelease;
  readonly event: SiteEvent;
  readonly here: SitePath;
}) {
  const { actor, claim } = event;
  const stored =
    event.days.length === 0
      ? 'No day stored.'
      : `Stored as ${event.precision ?? 'day'}: ${event.days.join(', ')}.`;
  return (
    <li className="flex flex-col gap-0.5 border-l border-border pl-2">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{event.kind ?? 'Kind not stored'}</span>
        <span>
          {event.written === null ? 'The source gives no words for the day.' : `“${event.written}”`}
        </span>
        <span className="tabular-nums">{stored}</span>
        {claim === null ? null : (
          <a
            className={LINK}
            href={hrefFrom(here, claimPage(claim.id))}
            aria-label={`Claim: ${claimText(claim)}`}
          >
            Claim
          </a>
        )}
      </p>
      <p>
        {actor === null ? (
          'No actor stored.'
        ) : (
          <>
            Claimed by{' '}
            {release.entityById.has(actor.id) ? (
              <a className={LINK} href={hrefFrom(here, entityPage(actor.id))}>
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
        event.denials.map(({ claim: denied, source, passage }, index) => (
          <figure key={`${denied.id} ${source.documentId} ${String(index)}`}>
            <blockquote className="max-w-prose bg-muted px-2 py-1">{passage.excerpt}</blockquote>
            <figcaption className="text-muted-foreground">
              Counter-statement in <DocumentName source={source} />, page {passage.page}.
            </figcaption>
          </figure>
        ))
      )}
    </li>
  );
}

/** The lane of the events that a party claimed about one site, and a counter of the claimed
 * strikes that the release stores. The counter is a lower bound, and the page says so. */
export function EventLane({ release, siteId, here }: EventLaneProps) {
  const events = eventsAt(release, siteId);
  const strikes = strikeCount(events);
  return (
    <section className="flex flex-col gap-1">
      <h2 className="font-medium">Events</h2>
      <p>
        At least {String(strikes)} claimed and stored {strikes === 1 ? 'strike' : 'strikes'}.
      </p>
      <p className="max-w-prose text-muted-foreground">
        The count holds only the strikes that a party claimed and that this registry stored from the
        documents it read. Other strikes can exist. It is not a count of all strikes.
      </p>
      {events.length === 0 ? (
        <p>The release holds no event for this site.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((event) => (
            <EventItem key={event.id} release={release} event={event} here={here} />
          ))}
        </ul>
      )}
    </section>
  );
}
