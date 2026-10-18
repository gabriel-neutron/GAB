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
  /** Who decided the entity and the licence of its row, as the release words them. Null where
   * the page reads the live record, because the live page words its own decision. */
  readonly label: { readonly origin: string; readonly licence: string } | null;
  /** The identifiers of the claims that the release holds about the entity: its values, and each
   * relation that starts or ends at it. A row links its claim page only when the release holds
   * the claim. */
  readonly claimIds: readonly string[];
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
  const row = withEvents ? release.entityById.get(entityId) : undefined;
  const drawsEvents = withEvents && (SITE_TYPES.has(entityType) || events.length > 0);
  return {
    imo: release.imoOfVessel.get(entityId) ?? null,
    label: row === undefined ? null : { origin: row.originLabel, licence: row.licence },
    claimIds: (release.claimsAbout.get(entityId) ?? []).map((claim) => claim.id),
    merged: [...release.aliases].filter(([, survivor]) => survivor === entityId).map(([id]) => id),
    events: drawsEvents
      ? events.map((event) => ({
          event,
          actorKnown: event.actor !== null && release.entityById.has(event.actor.id),
        }))
      : null,
  };
}
