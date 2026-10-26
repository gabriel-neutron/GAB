import { expect, it } from 'vitest';

import { legendOf } from './legend';
import type { ShownCounts } from './shown-counts';

const counts = (byType: [string, number][], byRelationType: [string, number][]): ShownCounts => ({
  entities: { shown: 0, total: 0 },
  relations: { shown: 0, total: 0 },
  byType: new Map(byType.map(([key, shown]) => [key, { shown, total: shown }])),
  byRelationType: new Map(byRelationType.map(([key, shown]) => [key, { shown, total: shown }])),
});

it('lists only the types and the families in view, in the order of the design system', () => {
  const legend = legendOf(
    counts(
      [
        ['company', 2],
        ['vessel', 1],
        ['port', 0],
      ],
      [
        ['sts_with', 1],
        ['owns', 3],
      ],
    ),
  );
  expect(legend.types.map(({ key }) => key)).toEqual(['vessel', 'company']);
  expect(legend.families.map(({ key }) => key)).toEqual(['ownership', 'transfer']);
});

it('counts a type with no glyph as unknown', () => {
  const legend = legendOf(
    counts(
      [
        ['invented', 2],
        ['unknown', 1],
      ],
      [],
    ),
  );
  expect(legend.types).toEqual([{ key: 'unknown', count: 3 }]);
});
