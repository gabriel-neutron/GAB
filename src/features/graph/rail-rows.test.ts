import { describe, expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { buildGraphModel, type NodePosition } from './model';
import { deriveRailRows, type RailView } from './rail-rows';

const positions: ReadonlyMap<string, NodePosition> = new Map(
  corpus.entities.map((entity, index) => [entity.id, { x: index, y: index }]),
);

const model = buildGraphModel(corpus, positions, entityTypes, 'dark');

const first = corpus.entities[0];
if (first === undefined) throw new Error('The committed corpus holds no entity');

const VIEW: RailView = {
  filter: { hiddenTypes: [] },
  selection: null,
  openUnits: new Set(),
  railOpen: true,
  railWidth: 256,
};

const labelsOf = (query: string): readonly string[] =>
  deriveRailRows(model, VIEW, { openTypes: [first.type], wholeList: [first.type] }, query)
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
  deriveRailRows(model, VIEW, { openTypes, wholeList: [] }, query);

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
      { ...VIEW, filter: { hiddenTypes: [first.type] } },
      { openTypes: [], wholeList: [] },
      first.label,
    );

    expect(rows.rail.types.find((row) => row.type === first.type)?.open).toBe(false);
  });
});

const UNIT = 'military_unit';
const parent = model.graph
  .nodes()
  .find(
    (node) =>
      model.graph.getNodeAttribute(node, 'entityType') === UNIT &&
      model.hierarchy.subordinatesOf(node).length > 0,
  );
if (parent === undefined) throw new Error('The committed corpus holds no unit with a subordinate');
const [child] = model.hierarchy.subordinatesOf(parent);
if (child === undefined) throw new Error('The committed corpus holds no subordinate');

const unitRows = (openUnits: ReadonlySet<string>, query = '') =>
  deriveRailRows(model, { ...VIEW, openUnits }, { openTypes: [UNIT], wholeList: [] }, query);

describe('the chain of command in the graph rail', () => {
  it('lists no subordinate of a closed unit, and counts every unit of the type', () => {
    const rows = unitRows(new Set());
    const ids = rows.lists.get(UNIT)?.entities.map((row) => row.id) ?? [];
    const all = unitRows(new Set([parent]));
    const total = model.graph.filterNodes((_node, attrs) => attrs.entityType === UNIT).length;

    expect(ids).toContain(parent);
    expect(ids).not.toContain(child);
    expect(rows.rail.types.find((row) => row.type === UNIT)?.count).toBe(total);
    expect(all.rail.types.find((row) => row.type === UNIT)?.count).toBe(total);
  });

  it('lists the subordinate of an open unit one level under it', () => {
    const lines = unitRows(new Set([parent])).lists.get(UNIT)?.entities ?? [];
    const at = lines.findIndex((row) => row.id === parent);

    expect(lines[at]).toMatchObject({ depth: 0, open: true, subordinates: 1 });
    expect(lines[at + 1]).toMatchObject({ id: child, depth: 1 });
  });

  it('lists a folded match for a search, so the search still reaches it', () => {
    const label = model.graph.getNodeAttribute(child, 'label');
    const ids =
      unitRows(new Set(), label)
        .lists.get(UNIT)
        ?.entities.map((row) => row.id) ?? [];

    expect(ids).toContain(child);
  });

  it('carries the stored width of the rail to the rows', () => {
    expect(unitRows(new Set()).rail.width).toBe(256);
  });
});
