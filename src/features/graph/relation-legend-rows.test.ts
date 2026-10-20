import { describe, expect, it } from 'vitest';

import { deriveLegend } from './relation-legend-rows';

const wording = (key: string) => ({ label: key.replaceAll('_', ' '), inverseLabel: key });

const counts = new Map([
  ['owns', { shown: 3, total: 4 }],
  ['sts_with', { shown: 2, total: 2 }],
  ['operates', { shown: 0, total: 5 }],
]);

describe('the legend of the relation families', () => {
  it('lists the families that hold a relation, in the fixed order of the families', () => {
    const legend = deriveLegend(counts, new Set(), wording);
    expect(legend.map((family) => family.key)).toEqual(['ownership', 'operation', 'transfer']);
  });

  it('lists the types of a family with the count shown of the total', () => {
    const [ownership] = deriveLegend(counts, new Set(), wording);
    expect(ownership?.types).toEqual([
      { type: 'owns', label: 'owns', shown: 3, total: 4, on: true },
    ]);
  });

  it('marks a type that is switched off, and keeps its total', () => {
    const legend = deriveLegend(counts, new Set(['operates']), wording);
    const operation = legend.find((family) => family.key === 'operation');
    expect(operation?.types).toEqual([
      { type: 'operates', label: 'operates', shown: 0, total: 5, on: false },
    ]);
  });

  it('adds the counts of a family', () => {
    const legend = deriveLegend(
      new Map([
        ['owns', { shown: 3, total: 4 }],
        ['appoints', { shown: 1, total: 2 }],
      ]),
      new Set(),
      wording,
    );
    expect(legend[0]).toMatchObject({ key: 'ownership', shown: 4, total: 6 });
  });
});
