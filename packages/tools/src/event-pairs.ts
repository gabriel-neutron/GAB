import { readName } from '@gab/text/transliteration-key';

import { parseEventName } from './event-rules.ts';

export interface EventLabel {
  readonly id: string;
  readonly label: string;
}

export interface EventPair {
  readonly kind: string;
  readonly day: string;
  readonly events: EventLabel[];
}

/** The groups of two or more events with the same kind, the same day and the same site once the
 * site is in Latin letters: one event recorded twice, one label in each script. It only reads: it
 * never merges. Each group goes to a reviewer. A site with too few letters has no key and never
 * matches. */
export const eventPairs = (events: readonly EventLabel[]): EventPair[] => {
  const groups = new Map<string, { kind: string; day: string; events: EventLabel[] }>();
  for (const event of events) {
    const name = parseEventName(event.label);
    const key = name === null ? null : readName(name.site).key;
    if (name === null || key === null) continue;
    const { kind, day } = name;
    const at = JSON.stringify([kind, key, day]);
    const group = groups.get(at) ?? { kind, day, events: [] };
    group.events.push(event);
    groups.set(at, group);
  }
  return [...groups.values()].filter((group) => group.events.length > 1);
};
