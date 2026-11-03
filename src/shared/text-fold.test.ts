import { describe, expect, it } from 'vitest';

import { folded } from './text-fold';

describe('folded', () => {
  it('matches a name with a Cyrillic letter to the same name with Latin letters', () => {
    const stored = 'Gstaad Grace IІ';
    expect(folded(stored)).toBe(folded('Gstaad Grace II'));
    expect(folded(stored).includes(folded('gstaad grace ii'))).toBe(true);
  });

  it('matches an upper-case Cyrillic А, О and І to the Latin letters', () => {
    expect(folded('АОІ')).toBe('aoi');
  });
});
