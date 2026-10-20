import { MultiDirectedGraph } from 'graphology';
import { describe, expect, it } from 'vitest';

import type { EdgeAttrs, NodeAttrs } from './model';
import { describeDrawing, deriveTextView, type TextViewRules } from './text-view';

const node = (label: string, entityType = 'company', unplaced = false): NodeAttrs => ({
  x: 0,
  y: 0,
  size: 1,
  color: '#000000',
  label,
  entityType,
  degree: 0,
  isolate: false,
  unplaced,
});

const edge = (relationType: string): EdgeAttrs => ({
  size: 1,
  color: '#000000',
  type: 'ownership',
  relationType,
  validFrom: null,
  validTo: null,
});

const graph = new MultiDirectedGraph<NodeAttrs, EdgeAttrs>();
graph.addNode('a', node('Alpha'));
graph.addNode('b', node('Bravo'));
graph.addNode('c', node('Charlie', 'vessel'));
graph.addNode('d', node('Delta', 'company', true));
graph.addEdgeWithKey('e1', 'a', 'b', edge('owns'));
graph.addEdgeWithKey('e2', 'c', 'a', edge('manages'));
graph.addEdgeWithKey('e3', 'a', 'd', edge('owns'));

const words = (key: string) => ({ label: key, inverseLabel: `${key} by` });

const open: TextViewRules = {
  hiddenTypes: new Set(),
  showUnplaced: true,
  hiddenRelationTypes: new Set(),
};

describe('the text view of the selection', () => {
  it('is empty while nothing is selected', () => {
    expect(deriveTextView(graph, null, open, words)).toBeNull();
  });

  it('lists each neighbour of an entity with the type and the direction of the relation', () => {
    const view = deriveTextView(graph, { kind: 'entity', id: 'a' }, open, words);
    expect(view?.kind).toBe('entity');
    expect(view?.name).toBe('Alpha');
    expect(view?.rows.map((row) => [row.label, row.relation, row.direction])).toEqual([
      ['Bravo', 'owns', 'out'],
      ['Charlie', 'manages by', 'in'],
      ['Delta', 'owns', 'out'],
    ]);
    expect(view?.rows.map((row) => row.relationId)).toEqual(['e1', 'e2', 'e3']);
  });

  it('leaves out a neighbour that the type filter or the ring switch hides', () => {
    const view = deriveTextView(
      graph,
      { kind: 'entity', id: 'a' },
      { ...open, hiddenTypes: new Set(['vessel']), showUnplaced: false },
      words,
    );
    expect(view?.rows.map((row) => row.label)).toEqual(['Bravo']);
  });

  it('leaves out a relation of a type that the legend switches off', () => {
    const view = deriveTextView(
      graph,
      { kind: 'entity', id: 'a' },
      { ...open, hiddenRelationTypes: new Set(['owns']) },
      words,
    );
    expect(view?.rows.map((row) => row.label)).toEqual(['Charlie']);
  });

  it('names a relation by its two ends and lists the ends', () => {
    const view = deriveTextView(graph, { kind: 'relation', id: 'e2' }, open, words);
    expect(view?.kind).toBe('relation');
    expect(view?.name).toBe('Charlie manages Alpha');
    expect(view?.rows.map((row) => [row.label, row.direction])).toEqual([
      ['Charlie', 'out'],
      ['Alpha', 'in'],
    ]);
  });

  it('returns nothing for an element that the graph does not hold', () => {
    expect(deriveTextView(graph, { kind: 'entity', id: 'zz' }, open, words)).toBeNull();
  });
});

describe('the description of the drawing', () => {
  const counts = {
    entities: { shown: 4, total: 9 },
    relations: { shown: 3, total: 5 },
  };

  it('gives the counts when nothing is selected', () => {
    expect(describeDrawing(counts, null)).toBe(
      'Graph of 4 of 9 entities and 3 of 5 relations. Nothing is selected.',
    );
  });

  it('gives the name and the neighbour count of the selection', () => {
    const view = deriveTextView(graph, { kind: 'entity', id: 'a' }, open, words);
    expect(describeDrawing(counts, view)).toBe(
      'Graph of 4 of 9 entities and 3 of 5 relations. Selected: Alpha, with 3 neighbours.',
    );
  });
});
