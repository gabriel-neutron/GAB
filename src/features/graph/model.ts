// This file computes no position. Two layouts of one corpus moved the picture about half of its
// width, and convergence does not repair it. The node shape and the edge shape are declared,
// because the graphology default is an index signature of `any`.

import { MultiDirectedGraph } from 'graphology';

import { ENTITY_HUES, typeHues, type EntityHueSet } from '@/shared/entity-hues';
import type { Corpus, Proposal, Relation } from '@/shared/fixtures/types';

import { analyseStructure, topologyOf } from './structure';

export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

/** What is attached to one node. Sigma reads `x`, `y`, `size`, `color` and `label` by name. */
export interface NodeAttrs {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly color: string;
  readonly label: string;
  readonly entityType: string;
  readonly degree: number;
  readonly isolate: boolean;
}

export interface EdgeAttrs {
  readonly size: number;
  readonly color: string;
  readonly relationType: string;
  readonly validFrom: string | null;
  readonly validTo: string | null;
}

// Every colour the canvas paints, for one ground. Each one is `#rrggbb`: Sigma parses hex on the
// CPU, and an `hsl()` colour comes out black in silence.
export interface GraphPalette {
  readonly types: EntityHueSet;
  readonly isolate: string;
  readonly edge: string;
}

/** Which ground the canvas has. The light theme is on `:root`, the dark theme on `.dark`. */
export type GraphGround = 'light' | 'dark';

// Contrast against `--background` of the same ground, where the minimum is 3:1: `isolate` gives
// 8.6:1 and 8.7:1, `edge` gives 5.6:1. The `--border` hue gives 1.5:1 on the dark ground.
export const GRAPH_PALETTES: Readonly<Record<GraphGround, GraphPalette>> = Object.freeze({
  light: Object.freeze({ types: ENTITY_HUES.light, isolate: '#42494c', edge: '#5e6468' }),
  dark: Object.freeze({ types: ENTITY_HUES.dark, isolate: '#a9afb1', edge: '#848a8c' }),
});

const hexPair = (value: number): string => value.toString(16).padStart(2, '0');

// The hue composited over the page, and the result is opaque. Do not go back to an alpha channel:
// the relations are drawn under the nodes, and their line ends then show inside the dots.
export const dimmedColour = (colour: string, ground: string, fraction: number): string => {
  if (colour.length !== 7 || !colour.startsWith('#')) return colour;
  const value = Number.parseInt(colour.slice(1), 16);
  const under = Number.parseInt(ground.slice(1), 16);
  if (Number.isNaN(value) || Number.isNaN(under)) return colour;
  const mix = (shift: number): number =>
    Math.round(((value >> shift) & 0xff) * fraction + ((under >> shift) & 0xff) * (1 - fraction));
  return `#${hexPair(mix(16))}${hexPair(mix(8))}${hexPair(mix(0))}`;
};

// The colour of the page as hex, copied from `--background` of `src/index.css`. A CSS custom
// property never reaches the Sigma parser.
export const GROUND_HUE: Readonly<Record<GraphGround, string>> = Object.freeze({
  light: '#f7f8f9',
  dark: '#0b1013',
});

export interface GraphModel {
  readonly graph: MultiDirectedGraph<NodeAttrs, EdgeAttrs>;
  readonly pendingByTarget: ReadonlyMap<string, readonly Proposal[]>;
  // The hue of each type. A node is the wrong source: an isolate wears grey, so a type whose only
  // drawn entity is isolated would give a swatch that disagrees with the canvas.
  readonly hueOfType: ReadonlyMap<string, string>;
}

// The radius of a node of degree 0, in the units Sigma scales to pixels. At 1.6, a corpus of
// twenty-seven entities drew one pale pixel, which a person cannot find or click.
const SIZE_FLOOR = 4;

// The floor plus this range is the top radius, so the largest hub is about three times the radius
// of an isolate and about nine times its area.
const SIZE_RANGE = 9;

const isDrawable = (relation: Relation, drawn: ReadonlySet<string>): boolean =>
  relation.srcKind === 'entity' &&
  relation.dstKind === 'entity' &&
  drawn.has(relation.srcId) &&
  drawn.has(relation.dstId);

const isM4 = (relation: Relation): boolean =>
  relation.srcKind === 'relation' || relation.dstKind === 'relation';

function hold<T>(index: Map<string, T[]>, key: string, value: T): void {
  const held = index.get(key);
  if (held === undefined) index.set(key, [value]);
  else held.push(value);
}

export function buildGraphModel(
  corpus: Corpus,
  positions: ReadonlyMap<string, NodePosition>,
  palette: GraphPalette,
): GraphModel {
  const drawn = new Set<string>();
  for (const entity of corpus.entities) {
    if (!positions.has(entity.id)) continue;
    // A repeated identifier makes `addNode` throw, and an exception here takes the canvas with it.
    drawn.add(entity.id);
  }

  const rest = corpus.relations.filter((relation) => !isM4(relation));
  const edges: Relation[] = [];
  const edgeKeys = new Set<string>();
  for (const relation of rest) {
    if (!isDrawable(relation, drawn)) continue;
    // `MultiDirectedGraph` permits a parallel edge, and it refuses a repeated key.
    if (edgeKeys.has(relation.id)) continue;
    edgeKeys.add(relation.id);
    edges.push(relation);
  }

  const topology = topologyOf(
    drawn,
    edges.map((relation) => ({ source: relation.srcId, target: relation.dstId })),
  );
  const structure = analyseStructure(topology);

  const isolates = new Set(structure.isolates);

  // A graph of isolates has a span of 0. A division by 0 makes each size `Infinity` or `NaN`, and
  // Sigma draws nothing for either.
  const sizeSpan = Math.log1p(structure.largestDegree);

  // The index is over every type of the corpus. This file drops an entity with no position and
  // the map drops one with no geometry, so a drawn subset gives one type two hues, one per canvas.
  const hueOfType = typeHues(
    corpus.entities.map((entity) => entity.type),
    palette.types,
  );

  const graph = new MultiDirectedGraph<NodeAttrs, EdgeAttrs>();
  for (const entity of corpus.entities) {
    const position = positions.get(entity.id);
    if (position === undefined || graph.hasNode(entity.id)) continue;

    const degree = topology.degree(entity.id);
    const isolate = isolates.has(entity.id);
    graph.addNode(entity.id, {
      x: position.x,
      y: position.y,
      // `log1p(0)` is 0, so a node of degree 0 takes the floor.
      size: sizeSpan === 0 ? SIZE_FLOOR : SIZE_FLOOR + (Math.log1p(degree) / sizeSpan) * SIZE_RANGE,
      color: isolate ? palette.isolate : (hueOfType.get(entity.type) ?? palette.isolate),
      label: entity.label,
      entityType: entity.type,
      degree,
      isolate,
    });
  }

  for (const relation of edges) {
    graph.addDirectedEdgeWithKey(relation.id, relation.srcId, relation.dstId, {
      size: 1,
      color: palette.edge,
      relationType: relation.type,
      validFrom: relation.validFrom,
      validTo: relation.validTo,
    });
  }

  const pendingByTarget = new Map<string, Proposal[]>();
  for (const proposal of corpus.proposals) {
    if (proposal.status !== 'pending') continue;
    const target = proposal.targetId;
    if (target === null || proposal.targetKind === null) continue;
    const carried = proposal.targetKind === 'entity' ? drawn.has(target) : edgeKeys.has(target);
    if (carried) hold(pendingByTarget, target, proposal);
  }

  return { graph, pendingByTarget, hueOfType };
}
