import { expect, test } from 'vitest';

import { EXPORTS_RELEASE } from './fixture-release';
import { listingWords, matrixCounts } from './matrix-cells';

test('a regime that does not list the number says so in words', () => {
  expect(listingWords(null)).toStrictEqual({ mark: '○', words: 'not listed', endedOn: null });
});

test('a listing with no date says that the date is not in the release, and keeps its mark', () => {
  const words = listingWords({
    listedOn: null,
    endedOn: null,
    actId: 'a',
    actLabel: 'Act',
    claimId: 'c',
  });
  expect(words).toStrictEqual({ mark: '●', words: 'date not in release', endedOn: null });
});

test('the counts read the marks and the end dates of the rows', () => {
  expect(matrixCounts(EXPORTS_RELEASE.alignment)).toStrictEqual({
    rows: 2,
    euNotOfac: 1,
    ofacOrUkNotEu: 1,
    ended: 1,
  });
});
