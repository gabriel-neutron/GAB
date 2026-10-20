import { describe, expect, it } from 'vitest';

import { matchRange } from './match-range';

describe('matchRange', () => {
  it('finds the matched text in the original case', () => {
    expect(matchRange('MV Northern Ledger', 'northern')).toEqual({ start: 3, end: 11 });
  });

  it('ignores accents on both sides', () => {
    expect(matchRange('Café Zürich', 'zurich')).toEqual({ start: 5, end: 11 });
    expect(matchRange('Cafe Zurich', 'café')).toEqual({ start: 0, end: 4 });
  });

  it('maps a run of whitespace back to the original run', () => {
    expect(matchRange('Ledger   Shipping', 'ledger shipping')).toEqual({ start: 0, end: 17 });
  });

  it('trims the query as the search does', () => {
    expect(matchRange('Ledger', '  led ')).toEqual({ start: 0, end: 3 });
  });

  it('returns null for an empty query or no match', () => {
    expect(matchRange('Ledger', '   ')).toBeNull();
    expect(matchRange('Ledger', 'star')).toBeNull();
  });
});
