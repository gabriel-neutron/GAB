import { UndirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

/** One relation, as the layout reads it: two entities, and nothing else. */
export interface LayoutLink {
  readonly source: string;
  readonly target: string;
}

/** Where one entity is drawn. The units are the units of the picture and never pixels. */
export interface LayoutPosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

// ForceAtlas2 has no stop rule of its own, so the count of rounds is the whole run. Chosen: the
// picture of the fixture corpus stops changing to the eye well before it.
const ROUNDS = 300;

// The golden angle spreads the seeds of a spiral, so no two seeds start on one point. The library
// starts from the positions it is given, and a fixed seed makes one corpus give one picture.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Where each entity is drawn, from the entities and the relations between them. */
export function entityLayout(
  entities: readonly string[],
  links: Iterable<LayoutLink>,
): readonly LayoutPosition[] {
  const graph = new UndirectedGraph();
  const nodes = [...new Set(entities)];
  nodes.forEach((id, index) => {
    const reach = Math.sqrt(index + 1);
    graph.addNode(id, {
      x: reach * Math.cos(index * GOLDEN_ANGLE),
      y: reach * Math.sin(index * GOLDEN_ANGLE),
    });
  });

  // A self-loop joins no two entities, a link to an entity that is not drawn joins nothing that
  // is drawn, and a second relation between one pair adds no pull.
  for (const { source, target } of links)
    if (source !== target && graph.hasNode(source) && graph.hasNode(target))
      graph.mergeEdge(source, target);

  const placed = forceAtlas2(graph, {
    iterations: ROUNDS,
    settings: forceAtlas2.inferSettings(graph),
  });

  return nodes.map((id) => ({ id, x: placed[id]?.x ?? 0, y: placed[id]?.y ?? 0 }));
}
