import { describe, expect, it } from 'vitest';

import { startChoices } from './start-choice';

const NAMED = [
  { id: 'a', label: 'Aurora Shipping', degree: 9 },
  { id: 'b', label: 'Baltic Tanker', degree: 5 },
  { id: 'c', label: 'Aurora Star', degree: 2 },
];

describe('the starting choice of the graph', () => {
  it('offers the most connected entities first when the field is empty', () => {
    const choice = startChoices(NAMED, '', 2);

    expect(choice.shown.map((row) => row.id)).toEqual(['a', 'b']);
    expect(choice.total).toBe(3);
  });

  it('keeps the entities whose name holds the text, and ignores the case', () => {
    const choice = startChoices(NAMED, '  AURORA ', 5);

    expect(choice.shown.map((row) => row.id)).toEqual(['a', 'c']);
    expect(choice.total).toBe(2);
  });

  it('says how many match when it shows fewer', () => {
    const choice = startChoices(NAMED, 'a', 1);

    expect(choice.shown).toHaveLength(1);
    expect(choice.total).toBe(3);
  });

  it('shows nothing when no name holds the text', () => {
    expect(startChoices(NAMED, 'zzz', 5)).toEqual({ shown: [], total: 0 });
  });
});
