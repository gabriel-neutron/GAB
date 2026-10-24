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
});
