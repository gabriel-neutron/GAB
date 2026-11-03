import { describe, expect, it } from 'vitest';

import { foldLookalikes, LOOKALIKE_FROM, LOOKALIKE_TO } from './lookalikes.ts';

describe('foldLookalikes', () => {
  it('reads a name with a Cyrillic І as the name with a Latin i', () => {
    const stored = 'gstaad grace iі';
    expect(foldLookalikes(stored)).toBe('gstaad grace ii');
  });

  it('reads each lookalike as its Latin letter', () => {
    expect(foldLookalikes('аеорсху')).toBe('aeopcxy');
  });

  it('keeps a Cyrillic letter that has no lookalike', () => {
    expect(foldLookalikes('жбл')).toBe('жбл');
  });

  it('has one Latin letter for each Cyrillic letter', () => {
    expect(Array.from(LOOKALIKE_FROM)).toHaveLength(Array.from(LOOKALIKE_TO).length);
  });
});
