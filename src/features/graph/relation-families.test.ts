import { describe, expect, it } from 'vitest';

import { FAMILIES, familyOf } from './relation-families';

describe('the family of a relation type', () => {
  it('puts owns and sts with in two different families', () => {
    expect(familyOf('owns')).toBe('ownership');
    expect(familyOf('sts_with')).toBe('transfer');
  });

  it('puts the three acts of a listing in the designation family', () => {
    expect(['designated_by', 'restricted_by', 'exempted_by'].map(familyOf)).toEqual([
      'designation',
      'designation',
      'designation',
    ]);
  });

  it('puts the issuer of an act in the designation family', () => {
    expect(familyOf('issued_by')).toBe('designation');
  });

  it('puts operates in the operation family', () => {
    expect(familyOf('operates')).toBe('operation');
  });

  it('puts a type that no family names in the other family, and so does a key of the prototype', () => {
    expect(familyOf('associated_with')).toBe('other');
    expect(familyOf('a_word_nobody_declared')).toBe('other');
    expect(familyOf('constructor')).toBe('other');
  });
});

describe('the look of the families', () => {
  it('gives each family its own dash pattern, so the difference works without colour', () => {
    const patterns = FAMILIES.map((family) => family.dash.join(','));
    expect(new Set(patterns).size).toBe(FAMILIES.length);
  });

  it('gives each family its own hue on each ground', () => {
    for (const ground of ['light', 'dark'] as const) {
      const hues = FAMILIES.map((family) => family.hue[ground]);
      expect(new Set(hues).size).toBe(FAMILIES.length);
    }
  });

  it('writes each hue as #rrggbb, which Sigma parses on the CPU', () => {
    for (const family of FAMILIES) {
      expect(family.hue.light).toMatch(/^#[0-9a-f]{6}$/u);
      expect(family.hue.dark).toMatch(/^#[0-9a-f]{6}$/u);
    }
  });
});
