import { MultiDirectedGraph } from 'graphology';
import { describe, expect, it } from 'vitest';

import type { EdgeAttrs, NodeAttrs } from './model';
import { countShown } from './shown-counts';

const node = (entityType: string): NodeAttrs => ({
  x: 0,
  y: 0,
  size: 1,
  color: '#000000',
  label: entityType,
  entityType,
  degree: 0,
  isolate: false,
  unplaced: false,
});

const edge: EdgeAttrs = {
  size: 1,
  color: '#000000',
  type: 'ownership',
  relationType: 'owns',
  validFrom: null,
  validTo: null,
};

const graph = new MultiDirectedGraph<NodeAttrs, EdgeAttrs>();
graph.addNode('a', node('vessel'));
graph.addNode('b', node('vessel'));
graph.addNode('c', node('company'));
graph.addEdgeWithKey('e1', 'a', 'c', edge);
graph.addEdgeWithKey('e2', 'b', 'c', edge);

describe('what the drawing shows, against what the record holds', () => {
  it('counts every entity and relation when every node is shown', () => {
    const counts = countShown(graph, new Set(['a', 'b', 'c']), new Set());
    expect(counts.entities).toEqual({ shown: 3, total: 3 });
    expect(counts.relations).toEqual({ shown: 2, total: 2 });
    expect(counts.byType.get('vessel')).toEqual({ shown: 2, total: 2 });
  });

  it('counts a relation only when both of its ends are shown', () => {
    const counts = countShown(graph, new Set(['a', 'c']), new Set());
    expect(counts.entities).toEqual({ shown: 2, total: 3 });
    expect(counts.relations).toEqual({ shown: 1, total: 2 });
  });

  it('keeps the total of a type that has no shown node', () => {
    const counts = countShown(graph, new Set(['c']), new Set());
    expect(counts.byType.get('vessel')).toEqual({ shown: 0, total: 2 });
    expect(counts.byType.get('company')).toEqual({ shown: 1, total: 1 });
  });

  it('leaves out the relations of a type that is switched off, and keeps its total', () => {
    const counts = countShown(graph, new Set(['a', 'b', 'c']), new Set(['owns']));
    expect(counts.relations).toEqual({ shown: 0, total: 2 });
    expect(counts.byRelationType.get('owns')).toEqual({ shown: 0, total: 2 });
  });

  it('counts each relation type apart', () => {
    const mixed = new MultiDirectedGraph<NodeAttrs, EdgeAttrs>();
    mixed.addNode('a', node('vessel'));
    mixed.addNode('b', node('vessel'));
    mixed.addEdgeWithKey('e1', 'a', 'b', edge);
    mixed.addEdgeWithKey('e2', 'a', 'b', { ...edge, type: 'transfer', relationType: 'sts_with' });
    const counts = countShown(mixed, new Set(['a', 'b']), new Set(['sts_with']));
    expect(counts.byRelationType.get('owns')).toEqual({ shown: 1, total: 1 });
    expect(counts.byRelationType.get('sts_with')).toEqual({ shown: 0, total: 1 });
    expect(counts.relations).toEqual({ shown: 1, total: 2 });
  });
});
