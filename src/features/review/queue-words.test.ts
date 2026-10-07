import { expect, it } from 'vitest';

import { queueWords } from './queue-words';

it('says that the queue is empty only when no unit waits', () => {
  expect(queueWords({ read: 0, before: 0, matched: 0, total: 0, filtered: false })).toStrictEqual({
    count: '0 units wait',
    empty: 'The queue is empty.',
  });
  expect(queueWords({ read: 0, before: 0, matched: 0, total: 0, filtered: true }).empty).toBe(
    'The queue is empty.',
  );
});

it('says that no unit matches when a filter finds nothing in a queue that holds units', () => {
  expect(queueWords({ read: 0, before: 0, matched: 0, total: 1082, filtered: true })).toStrictEqual(
    { count: '0 of 1082 units match the filter', empty: 'No unit matches this filter.' },
  );
});

it('counts the units read and the units that wait', () => {
  expect(
    queueWords({ read: 1082, before: 0, matched: 1082, total: 1082, filtered: false }),
  ).toStrictEqual({ count: '1082 units wait', empty: null });
  expect(
    queueWords({ read: 50, before: 0, matched: 1082, total: 1082, filtered: false }).count,
  ).toBe('50 of 1082 units read');
  expect(queueWords({ read: 9, before: 0, matched: 9, total: 1082, filtered: true }).count).toBe(
    '9 of 1082 units match the filter',
  );
  expect(queueWords({ read: 50, before: 0, matched: 126, total: 1082, filtered: true }).count).toBe(
    '50 of 126 units read. 126 of 1082 units match the filter',
  );
});

it('says where the list starts when it starts after the first unit', () => {
  expect(
    queueWords({ read: 50, before: 100, matched: 1082, total: 1082, filtered: false }),
  ).toStrictEqual({ count: 'Units 101 to 150 of 1082', empty: null });
  expect(queueWords({ read: 0, before: 9, matched: 9, total: 1082, filtered: true })).toStrictEqual(
    {
      count: '9 of 1082 units match the filter',
      empty: 'No unit comes after this place in the queue.',
    },
  );
});
