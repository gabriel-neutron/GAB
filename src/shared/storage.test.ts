import { describe, expect, it } from 'vitest';

import { holdsOnlyDeclaredKeys } from './storage';

const DECLARED = { sort: true, openRecord: true } as const;

describe('the closed key set of a stored workspace', () => {
  it('refuses a record that carries a key the code no longer declares', () => {
    expect(holdsOnlyDeclaredKeys({ sort: 'name', dead: 1 }, DECLARED)).toBe(false);
    expect(
      holdsOnlyDeclaredKeys({ toString: 'a name of Object' }, DECLARED),
      'an own key that Object also names is still an undeclared key',
    ).toBe(false);
  });

  it('takes a record that holds a part of the declared keys', () => {
    expect(holdsOnlyDeclaredKeys({ sort: 'name' }, DECLARED)).toBe(true);
    expect(holdsOnlyDeclaredKeys({}, DECLARED), 'each writer writes one key alone').toBe(true);
  });

  it('refuses null, an array and a string', () => {
    expect(holdsOnlyDeclaredKeys(null, DECLARED)).toBe(false);
    expect(holdsOnlyDeclaredKeys([], DECLARED)).toBe(false);
    expect(holdsOnlyDeclaredKeys('sort', DECLARED)).toBe(false);
  });
});
