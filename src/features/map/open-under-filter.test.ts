import { describe, expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { openTypesUnderFilter } from './open-under-filter';
import { project, railLegend } from './projection';

const projection = project(corpus, entityTypes);
const legend = railLegend(projection, () => true, new Set());

const first = projection.entities[0];
if (first === undefined) throw new Error('The committed corpus draws no entity on the map');

const typesHolding = (query: string): readonly string[] =>
  projection.types
    .map(({ type }) => type)
    .filter((type) =>
      projection.entities.some(
        (entity) =>
          entity.type === type && entity.label.toLowerCase().includes(query.toLowerCase()),
      ),
    );

describe('the open groups of the map rail under the filter of the screen', () => {
  it('opens each type that holds a match, and only those', () => {
    const opened = openTypesUnderFilter(legend, projection.entities, [], first.label);

    expect(opened).toContain(first.type);
    expect([...opened].sort()).toEqual([...typesHolding(first.label)].sort());
  });

  it('keeps each group the analyst opened, with a match or without one', () => {
    const other = projection.types.find(({ type }) => type !== first.type)?.type ?? first.type;
    const opened = openTypesUnderFilter(legend, projection.entities, [other], first.label);

    expect(opened).toContain(other);
    expect(opened).toContain(first.type);
  });

  it('gives back the groups the analyst chose when the filter is empty', () => {
    const chosen = [first.type];

    expect(openTypesUnderFilter(legend, projection.entities, chosen, '')).toBe(chosen);
    expect(openTypesUnderFilter(legend, projection.entities, [], '  ')).toEqual([]);
  });

  it('opens no type that is switched off', () => {
    const offLegend = railLegend(projection, (type) => type !== first.type, new Set());

    expect(openTypesUnderFilter(offLegend, projection.entities, [], first.label)).not.toContain(
      first.type,
    );
  });
});
