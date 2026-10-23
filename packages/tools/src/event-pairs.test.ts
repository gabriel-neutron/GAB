import { expect, test } from 'vitest';

import { eventPairs } from './event-pairs.ts';

const event = (id: string, label: string) => ({ id, label });

test('flags a Latin and a Cyrillic event of one facility, kind and day', () => {
  const groups = eventPairs([
    event('a', 'fire — Volgograd — 2026-09-15'),
    event('b', 'fire — Волгоград — 2026-09-15'),
    event('c', 'fire — Volgograd — 2026-09-16'),
    event('d', 'stoppage — Volgograd — 2026-09-15'),
  ]);
  expect(groups.map((group) => group.events.map((one) => one.id))).toEqual([['a', 'b']]);
});

test('flags nothing for a label that is not an event name', () => {
  expect(eventPairs([event('a', 'Syzran'), event('b', 'Сызрань')])).toEqual([]);
});

test('flags nothing for two sites with too few letters', () => {
  expect(
    eventPairs([event('a', 'fire — X — 2026-09-15'), event('b', 'fire — Х — 2026-09-15')]),
  ).toEqual([]);
});
