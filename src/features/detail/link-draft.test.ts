import { expect, test } from 'vitest';

import { linkWords, readLinkDraft, type LinkForm } from './link-draft';

const SRC_ID = '0ea482d0-cd00-4c77-911e-419dd2d1779f';
const DST_ID = 'e0a8a817-0dac-49db-8627-a342609a3092';

const NOT_A_DAY = 'Write each end of the interval as a year, a month and a day.';
const BACKWARDS = 'The interval starts after it ends. Correct one of the two days.';

const form = (given: Partial<LinkForm>): LinkForm => ({
  type: 'owns',
  dstId: DST_ID,
  validFrom: '',
  validTo: '',
  ...given,
});

const wordsOf = (given: Partial<LinkForm>): string => linkWords(readLinkDraft(SRC_ID, form(given)));

test('a day that the calendar does not hold is refused at either end', () => {
  expect(wordsOf({ validFrom: '2019-02-30' })).toBe(NOT_A_DAY);
  expect(wordsOf({ validTo: '2019-02-30' })).toBe(NOT_A_DAY);
  expect(wordsOf({ validFrom: '1 January 2019' })).toBe(NOT_A_DAY);
});

test('an interval that starts after it ends is refused', () => {
  expect(wordsOf({ validFrom: '2020-01-01', validTo: '2010-01-01' })).toBe(BACKWARDS);
});

test('an interval of one day is ready', () => {
  expect(
    readLinkDraft(SRC_ID, form({ validFrom: '2020-01-01', validTo: '2020-01-01' })).ready,
  ).toBe(true);
});

test('an interval with an end alone gives an act with no start', () => {
  expect(readLinkDraft(SRC_ID, form({ validTo: '2024-02-29' }))).toStrictEqual({
    ready: true,
    act: {
      op: 'create_relation',
      type: 'owns',
      srcId: SRC_ID,
      dstId: DST_ID,
      validFrom: null,
      validTo: '2024-02-29',
    },
  });
});
