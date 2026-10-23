import { readName } from '@gab/text/transliteration-key';

export interface EventLabel {
  readonly id: string;
  readonly label: string;
}

export interface EventPair {
  readonly kind: string;
  readonly day: string;
  readonly events: EventLabel[];
}

// The name of an event is "kind — site — day" (see event-rules.ts). The site may hold a dash.
const NAME = /^(.+?) — (.+) — (\d{4}-\d{2}(?:-\d{2})?)$/u;

/** The groups of two or more events with the same kind, the same day and the same site once the
 * site is in Latin letters: one event recorded twice, one label in each script. It only reads: it
 * never merges. Each group goes to a reviewer. A site with too few letters has no key and never
 * matches. */
export const eventPairs = (events: readonly EventLabel[]): EventPair[] => {
  const groups = new Map<string, { kind: string; day: string; events: EventLabel[] }>();
  for (const event of events) {
    const [, kind, site, day] = NAME.exec(event.label) ?? [];
    const key = site === undefined ? null : readName(site).key;
    if (kind === undefined || day === undefined || key === null) continue;
    const at = JSON.stringify([kind, key, day]);
    const group = groups.get(at) ?? { kind, day, events: [] };
    group.events.push(event);
    groups.set(at, group);
  }
  return [...groups.values()].filter((group) => group.events.length > 1);
};
