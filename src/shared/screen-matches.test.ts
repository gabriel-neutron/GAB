import { describe, expect, it } from 'vitest';

import { matchesNamed, nextActive } from './screen-matches';

const ports = ['Tartus', 'Latakia', 'Port Said', 'Port Sudan', 'Baniyas'].map((label, index) => ({
  id: `e${String(index)}`,
  label,
}));

const many = Array.from({ length: 11 }, (_, index) => ({
  id: `p${String(index)}`,
  label: `Pier ${String(index)}`,
}));

describe('the names the header lists under its filter', () => {
  it('lists each name that holds the filter, in the order the screen gives', () => {
    expect(matchesNamed(ports, 'PORT')).toEqual({
      shown: [
        { id: 'e2', label: 'Port Said' },
        { id: 'e3', label: 'Port Sudan' },
      ],
      more: 0,
    });
  });

  it('lists no name when the filter is empty or blank', () => {
    expect(matchesNamed(ports, '')).toEqual({ shown: [], more: 0 });
    expect(matchesNamed(ports, '   ')).toEqual({ shown: [], more: 0 });
  });

  it('shows eight names and counts the names past the eighth', () => {
    const matches = matchesNamed(many, 'pier');
    expect(matches.shown.map((match) => match.id)).toEqual(many.slice(0, 8).map((pier) => pier.id));
    expect(matches.more).toBe(3);
  });
});

describe('the active row of the header list', () => {
  it('starts at the first row going down and at the last row going up', () => {
    expect(nextActive(null, 1, 4)).toBe(0);
    expect(nextActive(null, -1, 4)).toBe(3);
  });

  it('wraps at each end', () => {
    expect(nextActive(3, 1, 4)).toBe(0);
    expect(nextActive(0, -1, 4)).toBe(3);
  });

  it('holds no row in an empty list', () => {
    expect(nextActive(null, 1, 0)).toBeNull();
  });
});
