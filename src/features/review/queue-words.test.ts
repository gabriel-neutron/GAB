import { expect, it } from 'vitest';

import { queueWords, type QueueCounts } from './queue-words';

// `total` is the count of the units of the list, and the list is the doubts or the units that wait.
const counts = (extra: Partial<QueueCounts>): QueueCounts => ({
  read: 0,
  before: 0,
  matched: 0,
  total: 0,
  filtered: false,
  lane: 'doubt',
  ...extra,
});

it('says that no doubt needs the operator when the list of the doubts is empty', () => {
  expect(queueWords(counts({}))).toStrictEqual({
    count: '0 doubts',
    empty: 'No doubt needs a decision of the operator.',
  });
  expect(queueWords(counts({ lane: 'waiting' }))).toStrictEqual({
    count: '0 units wait for a source',
    empty: 'No unit waits for a source.',
  });
});

it('says that no unit matches when a filter finds nothing in a list that holds units', () => {
  expect(queueWords(counts({ total: 40, filtered: true }))).toStrictEqual({
    count: '0 of 40 units match the filter',
    empty: 'No unit matches this filter.',
  });
});

it('counts the units read and the units of the list', () => {
  expect(queueWords(counts({ read: 40, matched: 40, total: 40 }))).toStrictEqual({
    count: '40 doubts',
    empty: null,
  });
  expect(queueWords(counts({ lane: 'waiting', read: 40, matched: 40, total: 40 })).count).toBe(
    '40 units wait for a source',
  );
  expect(queueWords(counts({ read: 50, matched: 1082, total: 1082 })).count).toBe(
    '50 of 1082 units read',
  );
  expect(queueWords(counts({ read: 9, matched: 9, total: 40, filtered: true })).count).toBe(
    '9 of 40 units match the filter',
  );
  expect(queueWords(counts({ read: 50, matched: 126, total: 1082, filtered: true })).count).toBe(
    '50 of 126 units read. 126 of 1082 units match the filter',
  );
});

it('says where the list starts when it starts after the first unit', () => {
  expect(queueWords(counts({ read: 50, before: 100, matched: 1082, total: 1082 }))).toStrictEqual({
    count: 'Units 101 to 150 of 1082',
    empty: null,
  });
  expect(queueWords(counts({ before: 9, matched: 9, total: 40, filtered: true }))).toStrictEqual({
    count: '9 of 40 units match the filter',
    empty: 'No unit comes after this place in the queue.',
  });
});
