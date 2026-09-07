import { describe, expect, it } from 'vitest';

import type { AdmiraltyOrigin, DocumentRow } from './model';
import { readRating } from './rating';

const row = (admiralty: string | null, admiraltyOrigin: AdmiraltyOrigin | null): DocumentRow => ({
  id: 'doc_0001',
  kind: 'report',
  title: 'A document',
  uri: null,
  archiveUri: null,
  sha256: null,
  retrievedAt: '2026-08-01',
  admiralty,
  admiraltyOrigin,
});

describe('the ADMIRALTY rating of one document', () => {
  it('carries the score, the origin and the band', () => {
    expect(readRating(row('A1', 'human'))).toStrictEqual({
      rated: true,
      score: 'A1',
      scoreOrigin: 'human',
      poor: false,
    });
    expect(readRating(row('D4', 'arbitrated')).poor, 'a low letter is a poor band').toBe(true);
    expect(readRating(row('B5', 'machine')).poor, 'a high figure is a poor band').toBe(true);
  });

  it('says an unrated document and an absent row are not rated, and neither is poor', () => {
    const absent = { rated: false, score: 'not rated', scoreOrigin: '', poor: false };
    expect(readRating(row(null, null))).toStrictEqual(absent);
    expect(readRating(undefined)).toStrictEqual(absent);
  });

  it('says a half-rated row is incomplete, and never rates it', () => {
    expect(readRating(row('A1', null))).toStrictEqual({
      rated: false,
      score: 'rating incomplete',
      scoreOrigin: 'a rating and its origin are absent together',
      poor: false,
    });
    expect(readRating(row(null, 'human')).score).toBe('rating incomplete');
  });
});
