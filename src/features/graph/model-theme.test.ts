import { expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { buildGraphModel } from './model';

it('changes the paint without changing the graph positions or its relations', () => {
  const positions = new Map(
    corpus.entities.map((entity, index) => [entity.id, { x: index, y: index }]),
  );
  const model = buildGraphModel(corpus, positions, entityTypes, 'dark', new Set());
  const light = buildGraphModel(corpus, positions, entityTypes, 'light', new Set());
  const graph = model.graph;
  const before = graph.export();
  model.setGround('light');
  expect(model.graph).toBe(graph);
  expect(graph.nodes()).toEqual(before.nodes.map((node) => node.key));
  graph.forEachNode((id, attrs) => {
    expect({ x: attrs.x, y: attrs.y }).toEqual(positions.get(id));
    expect(attrs.color).toBe(light.graph.getNodeAttribute(id, 'color'));
  });
  expect(graph.edges()).toEqual(light.graph.edges());
  graph.forEachEdge((id, attrs) => {
    expect(attrs.color).toBe(light.graph.getEdgeAttribute(id, 'color'));
  });
  expect(model.hueOfType).toEqual(light.hueOfType);
});
