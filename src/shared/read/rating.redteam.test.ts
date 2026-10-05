import { describe, expect, it } from 'vitest';

import type { DocumentRow } from './model';
import { readBand, readRating } from './rating';

// The wire type of both columns is a plain string, so a row can reach the reader with a value that
// the record would have refused. Each value below is invented.
const row = (admiralty: string | null, admiraltyOrigin: string | null): DocumentRow =>
  ({
    id: 'doc_0001',
    kind: 'report',
    title: 'An invented page',
    uri: null,
    archiveUri: null,
    sha256: null,
    retrievedAt: '2026-08-01',
    admiralty,
    admiraltyOrigin,
  }) as DocumentRow;

describe('a rating that is outside the closed set', () => {
  it.each(['Z9', 'G1', 'A7', 'A0', 'a1', 'A', 'E', '6', 'A11', 'A1 ', ' A1', '', 'AA', 'A\n1'])(
    'does not read %j as a rating',
    (letterAndDigit) => {
      const read = readRating(row(letterAndDigit, 'human'));
      expect(read.rated, 'a garbled value is not a rating').toBe(false);
      expect(read.score).toBe('rating incomplete');
    },
  );

  it.each(['model', 'Human', 'operator', ''])('does not read the origin %j', (origin) => {
    const read = readRating(row('A1', origin));
    expect(read.rated, 'an origin outside the closed set is not an origin').toBe(false);
  });

  it('never prints a garbled value as the word of the band', () => {
    expect(readBand(row('Z9', 'human'))).toBe('rating incomplete');
  });
});

describe('the band of a valid rating', () => {
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const digits = [1, 2, 3, 4, 5, 6];

  it('marks a poor band for exactly the last three letters or the last three figures', () => {
    for (const letter of letters)
      for (const digit of digits) {
        const poor = 'DEF'.includes(letter) || digit >= 4;
        expect(
          readRating(row(`${letter}${String(digit)}`, 'human')).poor,
          `${letter}${digit}`,
        ).toBe(poor);
      }
  });
});
