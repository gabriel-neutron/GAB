import { describe, expect, it } from 'vitest';

import { matchParts } from './match-span';

describe('the parts of a name around the text that matched', () => {
  it('marks the matched text and keeps the case of the name', () => {
    expect(matchParts('Port of Tartus', 'TART')).toEqual([
      { text: 'Port of ', matched: false },
      { text: 'Tart', matched: true },
      { text: 'us', matched: false },
    ]);
  });

  it('matches through accents', () => {
    expect(matchParts('Société Générale', 'societe')).toEqual([
      { text: 'Société', matched: true },
      { text: ' Générale', matched: false },
    ]);
  });

  it('returns the whole name when nothing matches or the query is blank', () => {
    expect(matchParts('Port of Tartus', 'latakia')).toEqual([
      { text: 'Port of Tartus', matched: false },
    ]);
    expect(matchParts('Port of Tartus', '  ')).toEqual([
      { text: 'Port of Tartus', matched: false },
    ]);
  });

  it('places the mark after a character outside the basic plane', () => {
    expect(matchParts('😀 Port of Tartus', 'tartus')).toEqual([
      { text: '😀 Port of ', matched: false },
      { text: 'Tartus', matched: true },
    ]);
  });

  it('marks a run of spaces that the filter reads as one space', () => {
    expect(matchParts('Port  of Tartus', 'port of')).toEqual([
      { text: 'Port  of', matched: true },
      { text: ' Tartus', matched: false },
    ]);
  });

  it('keeps the accent mark of a decomposed letter inside the mark', () => {
    expect(matchParts('Cafe\u0301 Bar', 'cafe')).toEqual([
      { text: 'Cafe\u0301', matched: true },
      { text: ' Bar', matched: false },
    ]);
  });

  it('marks a Greek name that ends in a final sigma', () => {
    expect(matchParts('ΟΔΥΣΣΕΥΣ', 'οδυσσευς')).toEqual([{ text: 'ΟΔΥΣΣΕΥΣ', matched: true }]);
  });
});
