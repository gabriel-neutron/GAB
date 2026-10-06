import { expect, test } from 'vitest';

import { linkWords, readLinkDraft, type LinkForm } from './link-draft';

const SRC_ID = '0ea482d0-cd00-4c77-911e-419dd2d1779f';
const DST_ID = 'e0a8a817-0dac-49db-8627-a342609a3092';

const form = (given: Partial<LinkForm>): LinkForm => ({
  type: 'owns',
  dstId: DST_ID,
  validFrom: '',
  validTo: '',
  ...given,
});

const wordsOf = (given: Partial<LinkForm>): string => linkWords(readLinkDraft(SRC_ID, form(given)));

// The record holds each rule on the interval and words its refusal, so the form asks only for
// what the button needs.
test('a form with a type and an end is ready, and a form with no type is not', () => {
  expect(wordsOf({})).toBe('Ready to make one relation from this entity.');
  expect(wordsOf({ type: ' ' })).toBe('Write the type of the relation.');
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
