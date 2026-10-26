import { MultiDirectedGraph } from 'graphology';
import { describe, expect, it } from 'vitest';

import { edgeRing, hopDistances } from './hop-distance';
import type { EdgeAttrs, NodeAttrs } from './model';

const node: NodeAttrs = {
  x: 0,
  y: 0,
  size: 1,
  color: '#000000',
  label: 'node',
  type: 'unknown',
  candidate: false,
  entityType: 'company',
  degree: 0,
  isolate: false,
  unplaced: false,
};

const edge = (relationType: string): EdgeAttrs => ({
  size: 1,
  color: '#000000',
  type: 'ownership',
  relationType,
  validFrom: null,
  validTo: null,
});

// a - b - c - d, and a - e through a relation of the type `hidden`.
const graph = new MultiDirectedGraph<NodeAttrs, EdgeAttrs>();
for (const id of ['a', 'b', 'c', 'd', 'e']) graph.addNode(id, node);
graph.addEdgeWithKey('ab', 'a', 'b', edge('owns'));
graph.addEdgeWithKey('cb', 'c', 'b', edge('owns'));
graph.addEdgeWithKey('cd', 'c', 'd', edge('owns'));
graph.addEdgeWithKey('ae', 'a', 'e', edge('hidden'));

const every = new Set(graph.nodes());
const typeOn = (id: string): boolean => graph.getEdgeAttribute(id, 'relationType') !== 'hidden';

describe('the hop distance of a selection', () => {
  it('gives 0 to the seed, 1 and 2 to the rings, and stops after two hops', () => {
    expect(hopDistances(graph, ['a'], every, typeOn)).toEqual(
      new Map([
        ['a', 0],
        ['b', 1],
        ['c', 2],
      ]),
    );
  });

  it('walks in both directions of a relation', () => {
    expect(hopDistances(graph, ['d'], every, typeOn).get('b')).toBe(2);
  });

  it('gives 0 to the two ends of a selected relation', () => {
    const hops = hopDistances(graph, ['c', 'b'], every, typeOn);
    expect([hops.get('c'), hops.get('b'), hops.get('a'), hops.get('d')]).toEqual([0, 0, 1, 1]);
  });

  it('does not step through a node the filter excludes, or a relation type that is off', () => {
    const hops = hopDistances(graph, ['a'], new Set(['a', 'c', 'd', 'e']), typeOn);
    expect([...hops.keys()]).toEqual(['a']);
    expect(hopDistances(graph, ['a'], every, () => true).get('e')).toBe(1);
  });

  it('gives nothing for a seed that is not in the graph', () => {
    expect(hopDistances(graph, ['z'], every, typeOn).size).toBe(0);
  });
});

describe('the ring of a relation', () => {
  it('lights a step from the selection, and fades a step from the first ring to the second', () => {
    expect(edgeRing(0, 1)).toBe('lit');
    expect(edgeRing(1, 0)).toBe('lit');
    expect(edgeRing(1, 2)).toBe('faint');
    expect(edgeRing(0, 0)).toBe('lit');
  });

  it('dims a relation inside one ring, or one that skips a ring', () => {
    expect(edgeRing(1, 1)).toBe('dim');
    expect(edgeRing(2, 2)).toBe('dim');
    expect(edgeRing(0, 2)).toBe('dim');
  });
});
