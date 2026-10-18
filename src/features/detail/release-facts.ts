import { eventsAt, type SiteEvent } from '@gab/release/event-lane';
import type { SiteRelease } from '@gab/release/site-release';

/** One event of a site, and whether its actor has a page of its own. */
export interface EventLine {
  readonly event: SiteEvent;
  readonly actorKnown: boolean;
}

/** What a release adds to the page of one entity. */
export interface ReleaseFacts {
  /** The IMO number of the entity when it is a public vessel that has one. */
  readonly imo: string | null;
  /** The identifiers that a merge absorbed into this entity. */
  readonly merged: readonly string[];
  /** The events of a site, or null where the page draws no events part. */
  readonly events: readonly EventLine[] | null;
}

// The types that an event can happen at. Their page always gives the counter, so that a release
// with no stored event does not read as a release with no strike.
const SITE_TYPES: ReadonlySet<string> = new Set(['facility', 'port']);

/** The facts that the release holds about `entityId`. The events come from the release only, so a
 * page that reads the live record asks for none: the two would mix two dates. */
export function releaseFactsOf(
  release: SiteRelease,
  entityId: string,
  entityType: string,
  withEvents: boolean,
): ReleaseFacts {
  const events = withEvents ? eventsAt(release, entityId) : [];
  const drawsEvents = withEvents && (SITE_TYPES.has(entityType) || events.length > 0);
  return {
    imo: release.imoOfVessel.get(entityId) ?? null,
    merged: [...release.aliases].filter(([, survivor]) => survivor === entityId).map(([id]) => id),
    events: drawsEvents
      ? events.map((event) => ({
          event,
          actorKnown: event.actor !== null && release.entityById.has(event.actor.id),
        }))
      : null,
  };
}
