import { describe, expect, it } from 'vitest';

import { nameHoldsQuery } from './name-match';

describe('a name against the filter of the screen', () => {
  it('holds a part of the name in any case', () => {
    expect(nameHoldsQuery('Port of Tartus', 'TART')).toBe(true);
    expect(nameHoldsQuery('Port of Tartus', 'latakia')).toBe(false);
  });

  it('holds every name when the filter is empty or blank', () => {
    expect(nameHoldsQuery('Port of Tartus', '')).toBe(true);
    expect(nameHoldsQuery('Port of Tartus', '  ')).toBe(true);
  });
});
