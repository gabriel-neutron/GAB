import { describe, expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { buildGraphModel, type NodePosition } from './model';
import { deriveRailRows } from './rail-rows';

const positions: ReadonlyMap<string, NodePosition> = new Map(
  corpus.entities.map((entity, index) => [entity.id, { x: index, y: index }]),
);

const model = buildGraphModel(corpus, positions, entityTypes, 'dark');

const first = corpus.entities[0];
if (first === undefined) throw new Error('The committed corpus holds no entity');

const labelsOf = (query: string): readonly string[] =>
  deriveRailRows(
    model,
    { hiddenTypes: [] },
    { openTypes: [first.type], wholeList: [first.type] },
    null,
    true,
    query,
  )
    .lists.get(first.type)
    ?.entities.map((row) => row.label) ?? [];

describe('the open list of the graph rail under the filter of the screen', () => {
  it('keeps only the entities whose name holds the filter', () => {
    const query = first.label.slice(0, 3).toUpperCase();
    const kept = labelsOf(query);

    expect(kept).toContain(first.label);
    expect(kept.every((label) => label.toLowerCase().includes(query.toLowerCase()))).toBe(true);
    expect(kept.length).toBeLessThanOrEqual(labelsOf('').length);
  });
});

const rowsUnder = (query: string, openTypes: readonly string[]) =>
  deriveRailRows(model, { hiddenTypes: [] }, { openTypes, wholeList: [] }, null, true, query);

const typesHolding = (query: string): readonly string[] => [
  ...new Set(
    corpus.entities
      .filter((entity) => entity.label.toLowerCase().includes(query.toLowerCase()))
      .map((entity) => entity.type),
  ),
];

describe('the open groups of the graph rail under the filter of the screen', () => {
  it('opens each type that holds a match, while every group is closed', () => {
    const rows = rowsUnder(first.label, []);
    const opened = rows.rail.types.filter((row) => row.open).map((row) => row.type);

    expect([...opened].sort()).toEqual([...typesHolding(first.label)].sort());
    expect(rows.lists.get(first.type)?.entities.map((row) => row.label)).toContain(first.label);
  });

  it('gives back the groups the analyst chose when the filter is empty', () => {
    const rows = rowsUnder('', []);

    expect(rows.rail.types.some((row) => row.open)).toBe(false);
    expect(rows.lists.size).toBe(0);
  });

  it('keeps a group the analyst opened, with an empty list where no name matches', () => {
    const rows = rowsUnder('no name holds this text', [first.type]);

    expect(rows.rail.types.find((row) => row.type === first.type)?.open).toBe(true);
    expect(rows.lists.get(first.type)?.entities).toEqual([]);
  });

  it('opens no type that is switched off', () => {
    const rows = deriveRailRows(
      model,
      { hiddenTypes: [first.type] },
      { openTypes: [], wholeList: [] },
      null,
      true,
      first.label,
    );

    expect(rows.rail.types.find((row) => row.type === first.type)?.open).toBe(false);
  });
});
