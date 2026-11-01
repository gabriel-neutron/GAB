import { MultiDirectedGraph } from 'graphology';
import { describe, expect, it } from 'vitest';

import { layoutInput, pairWeight } from './layout-weights';
import { DEFAULT_VARIANT } from './variants';
import type { EdgeAttrs, NodeAttrs } from './model';

const node = (entityType: string): NodeAttrs => ({
  x: 0,
  y: 0,
  size: 1,
  color: '#000000',
  label: '',
  entityType,
  type: 'dot',
  candidate: false,
  degree: 0,
  isolate: false,
  unplaced: false,
});
const edge = (relationType: string, type: EdgeAttrs['type']): EdgeAttrs => ({
  size: 1,
  color: '#000000',
  type,
  relationType,
  validFrom: null,
  validTo: null,
});

const W = DEFAULT_VARIANT.weights;

const build = (): MultiDirectedGraph<NodeAttrs, EdgeAttrs> => {
  const graph = new MultiDirectedGraph<NodeAttrs, EdgeAttrs>();
  graph.addNode('a', node('vessel'));
  graph.addNode('b', node('company'));
  graph.addNode('c', node('person'));
  graph.addEdge('a', 'b', edge('owns', 'ownership'));
  graph.addEdge('b', 'a', edge('flags', 'ownership'));
  graph.addEdge('b', 'c', edge('designated_by', 'designation'));
  return graph;
};

describe('the weight of a pair', () => {
  it('is heavier for a strong family than for a weak one', () => {
    expect(pairWeight(['ownership'], W)).toBeGreaterThan(pairWeight(['transfer'], W));
  });
  it('grows with a repeated relation and stops at the cap', () => {
    expect(pairWeight(['other', 'other'], W)).toBeGreaterThan(pairWeight(['other'], W));
    expect(pairWeight(Array<'ownership'>(50).fill('ownership'), W)).toBe(6);
  });
});

describe('the nodes that take part after a filter', () => {
  it('joins the two directions of a pair in one link', () => {
    const input = layoutInput(build(), () => true, new Set(), W);
    expect(input.nodes).toEqual(['a', 'b', 'c']);
    expect(input.links).toHaveLength(2);
    expect(input.links.find((l) => l.source === 'a')?.weight).toBe(6);
  });
  it('drops a hidden node and its relations', () => {
    const graph = build();
    const input = layoutInput(
      graph,
      (n) => graph.getNodeAttribute(n, 'entityType') !== 'company',
      new Set(),
      W,
    );
    expect(input.nodes).toEqual([]);
    expect(input.rest).toEqual(['c', 'a']);
    expect(input.links).toEqual([]);
  });
  it('leaves no shown node out of the picture', () => {
    const input = layoutInput(build(), () => true, new Set(['owns', 'flags']), W);
    expect([...input.nodes, ...input.rest].sort()).toEqual(['a', 'b', 'c']);
  });
  it('drops a relation of a type that is off', () => {
    const input = layoutInput(build(), () => true, new Set(['owns', 'flags']), W);
    expect(input.links).toHaveLength(1);
    expect(input.links[0]?.weight).toBe(0.6);
  });
});
