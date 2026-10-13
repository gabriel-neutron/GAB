import {
  CLAIMED_ATTACK,
  EVENT_DAYS,
  EVENT_KIND,
  EVENT_PRECISION,
} from '@gab/tools/event-rules';

import type { SiteClaim, SitePassage, SiteRelease, SiteSource } from './site-release.ts';
import { elementsOf } from './vessel-timeline.ts';

/** A passage of a document that denies the event, with the document that holds it. */
export interface Denial {
  readonly claim: SiteClaim;
  readonly source: SiteSource;
  readonly passage: SitePassage;
}

/** One event that a party claimed about a site, as the release stores it. */
export interface SiteEvent {
  readonly id: string;
  readonly kind: string | null;
  /** The days as stored: two days for a night, one month or one day. */
  readonly days: readonly string[];
  readonly precision: string | null;
  /** The words of the source for the day. */
  readonly written: string | null;
  readonly actor: { readonly id: string; readonly label: string } | null;
  /** The claim that the lane links to: the day, or else the first claim of the event. */
  readonly claim: SiteClaim | null;
  /** The documents that assert the event. */
  readonly documents: readonly SiteSource[];
  readonly denials: readonly Denial[];
}

const DENIES = 'denies';

type AttributeClaim = Extract<SiteClaim, { readonly kind: 'attribute' }>;

const valueOf = (claims: readonly AttributeClaim[], key: string): AttributeClaim | undefined =>
  claims.find((one) => one.attribute === key);

const eventOf = (release: SiteRelease, id: string): SiteEvent => {
  const claims = release.claimsAbout.get(id) ?? [];
  const attributes = claims.filter((one) => one.kind === 'attribute');
  const day = valueOf(attributes, EVENT_DAYS);
  const actor = claims.find(
    (one) =>
      one.kind === 'relation' &&
      one.relation.type === 'carried_out_by' &&
      one.relation.fromId === id,
  );
  const written = day?.sources
    .flatMap((one) => one.passages)
    .find((one) => one.modality !== DENIES)?.excerpt;
  const documents = new Map<string, SiteSource>();
  const denials: Denial[] = [];
  for (const claim of claims)
    for (const source of claim.sources) {
      if (source.passages.length === 0 || source.passages.some((one) => one.modality !== DENIES))
        documents.set(source.documentId, source);
      for (const passage of source.passages)
        if (passage.modality === DENIES) denials.push({ claim, source, passage });
    }
  return {
    id,
    kind: valueOf(attributes, EVENT_KIND)?.value ?? null,
    days: day === undefined ? [] : elementsOf(day.value),
    precision: valueOf(attributes, EVENT_PRECISION)?.value ?? null,
    written: written ?? null,
    actor:
      actor?.kind === 'relation'
        ? { id: actor.relation.toId, label: actor.relation.toLabel }
        : null,
    claim: day ?? valueOf(attributes, EVENT_KIND) ?? attributes[0] ?? null,
    documents: [...documents.values()],
    denials,
  };
};

const byDay = (one: SiteEvent, two: SiteEvent): number => {
  const dayOne = one.days[0] ?? '￿';
  const dayTwo = two.days[0] ?? '￿';
  if (dayOne !== dayTwo) return dayOne < dayTwo ? -1 : 1;
  return one.id < two.id ? -1 : one.id > two.id ? 1 : 0;
};

/** The events that the release links to a site, in the order of their first day. */
export const eventsAt = (release: SiteRelease, siteId: string): readonly SiteEvent[] =>
  (release.claimsAbout.get(siteId) ?? [])
    .flatMap((claim) =>
      claim.kind === 'relation' &&
      claim.relation.type === 'occurred_at' &&
      claim.relation.toId === siteId
        ? [eventOf(release, claim.relation.fromId)]
        : [],
    )
    .sort(byDay);

/** The number of claimed strikes in a list of events. It is a lower bound of the strikes. */
export const strikeCount = (events: readonly SiteEvent[]): number =>
  events.filter((one) => one.kind === CLAIMED_ATTACK).length;
