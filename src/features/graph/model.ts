// This file computes no position. Two layouts of one corpus moved the picture about half of its
// width, and convergence does not repair it. The node shape and the edge shape are declared,
// because the graphology default is an index signature of `any`.

import { MultiDirectedGraph } from 'graphology';

import { typeHues, UNDECLARED_HUE } from '@/shared/entity-hues';
import { unitHierarchy, type UnitHierarchy } from '@/shared/fold-subordinates';
import { typeLabel } from '@/shared/type-label';
import type { Corpus, Proposal, Relation, TypeVocabulary } from '@/shared/read/model';

import { GLYPHS } from './glyphs';
import { familyOf, lookOf, type RelationFamily } from './relation-families';
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
  /** The key of the node program, which is the glyph of the type. Sigma reads it by this name. */
  readonly type: string;
  /** A candidate draws hollow, and promoted evidence draws filled. */
  readonly candidate: boolean;
  readonly degree: number;
  readonly isolate: boolean;
  /** The layout run gave it no place, and it stands on the ring. */
  readonly unplaced: boolean;
}

export interface EdgeAttrs {
  readonly size: number;
  readonly color: string;
  /** The family of the relation. Sigma reads the program of an edge from `type`. */
  readonly type: RelationFamily;
  readonly relationType: string;
  readonly validFrom: string | null;
  readonly validTo: string | null;
}

// The colours the canvas paints that no type declares, beside the hues of the relation families. Each one is `#rrggbb`: Sigma parses
// hex on the CPU, and an `hsl()` colour comes out black in silence. The hue of a type is not
// here: `entity_type` declares it, and this file reads that declaration.
interface GraphPalette {
  readonly isolate: string;
  readonly unplaced: string;
}

/** Which ground the canvas has. The light theme is on `:root`, the dark theme on `.dark`. */
export type GraphGround = 'light' | 'dark';

// `isolate` is the `relation-ownership` token and `unplaced` is the `entity-unknown` token, as hex.
const PALETTE_FALLBACK: Readonly<Record<GraphGround, GraphPalette>> = Object.freeze({
  light: Object.freeze({ isolate: '#5a5552', unplaced: '#6b6562' }),
  dark: Object.freeze({ isolate: '#b8b3b0', unplaced: '#8a8380' }),
});

const paletteOf = (ground: GraphGround): GraphPalette => ({
  isolate: tokenHex('--relation-ownership', PALETTE_FALLBACK[ground].isolate),
  unplaced: tokenHex('--entity-unknown', PALETTE_FALLBACK[ground].unplaced),
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

// The fallback of the page colour, the `--background` token as hex, for a page with no style.
const GROUND_FALLBACK: Readonly<Record<GraphGround, string>> = Object.freeze({
  light: '#eeeeee',
  dark: '#101010',
});

const rgbHex = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/;

/** The token as hex, resolved on the page now. Sigma parses hex alone and a CSS custom property
 * never reaches it. The page must wear the theme that `fallback` names, or the fallback stands. */
export function tokenHex(token: string, fallback: string): string {
  // A model built outside a page (a unit test) has no style to read.
  if (typeof document === 'undefined') return fallback;
  const probe = document.createElement('i');
  probe.style.color = `var(${token})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  const match = rgbHex.exec(resolved);
  if (match === null) return fallback;
  return `#${[match[1], match[2], match[3]].map((part) => hexPair(Number(part))).join('')}`;
}

/** The colour of the page, as it is in the theme now. */
export const groundHue = (ground: GraphGround): string =>
  tokenHex('--background', GROUND_FALLBACK[ground]);

/** The hue of a family, from its `--relation-*` token. */
export const familyHue = (family: RelationFamily, ground: GraphGround): string =>
  tokenHex(`--relation-${family}`, lookOf(family).hue[ground]);

export interface GraphModel {
  readonly setGround: (ground: GraphGround) => void;
  readonly graph: MultiDirectedGraph<NodeAttrs, EdgeAttrs>;
  readonly pendingByTarget: ReadonlyMap<string, readonly Proposal[]>;
  // The hue of each type. A node is the wrong source: an isolate wears grey, so a type whose only
  // drawn entity is isolated would give a swatch that disagrees with the canvas.
  readonly hueOfType: ReadonlyMap<string, string>;
  /** The label of a type, from the vocabulary. A key it does not hold reads by the rule of the keys. */
  readonly labelOfType: (type: string) => string;
  /** The chain of command between the drawn nodes. The rail folds its list by it. */
  readonly hierarchy: UnitHierarchy;
}

// The radius of a node of degree 0, in the units Sigma scales to pixels. The glyph box is twice
// the radius, so the floor is the 8px of the design system. At 1.6, a corpus of twenty-seven
// entities drew one pale pixel, which a person cannot find or click.
const SIZE_FLOOR = 4;

// The floor plus this range is the top radius: the largest hub is a box of 28px.
const SIZE_RANGE = 10;

const isDrawable = (relation: Relation, drawn: ReadonlySet<string>): boolean =>
  relation.srcKind === 'entity' &&
  relation.dstKind === 'entity' &&
  drawn.has(relation.srcId) &&
  drawn.has(relation.dstId);

const isM4 = (relation: Relation): boolean =>
  relation.srcKind === 'relation' || relation.dstKind === 'relation';

// A node on the ring is painted before all else: its place means nothing, so no other mark may
// make it read as a member of a cluster. An isolate is painted before its type, because the
// reader is told which elements stand alone before which kind of thing each one is. The two
// callers below state the rule one time: a node that the build paints and a node that a ground
// change repaints must take the same hue.
const hueOfNode = (
  attrs: Pick<NodeAttrs, 'isolate' | 'entityType' | 'unplaced'>,
  palette: GraphPalette,
  hueOfType: ReadonlyMap<string, string>,
  ground: GraphGround,
): string =>
  attrs.unplaced
    ? palette.unplaced
    : attrs.isolate
      ? palette.isolate
      : (hueOfType.get(attrs.entityType) ?? UNDECLARED_HUE[ground]);

function hold<T>(index: Map<string, T[]>, key: string, value: T): void {
  const held = index.get(key);
  if (held === undefined) index.set(key, [value]);
  else held.push(value);
}

export function buildGraphModel(
  corpus: Corpus,
  positions: ReadonlyMap<string, NodePosition>,
  types: TypeVocabulary,
  ground: GraphGround,
  unplaced: ReadonlySet<string>,
): GraphModel {
  const palette = paletteOf(ground);
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

  const hueOfType = new Map(typeHues(types, ground));

  const graph = new MultiDirectedGraph<NodeAttrs, EdgeAttrs>();
  for (const entity of corpus.entities) {
    const position = positions.get(entity.id);
    if (position === undefined || graph.hasNode(entity.id)) continue;

    const degree = topology.degree(entity.id);
    const isolate = isolates.has(entity.id);
    const unplacedNode = unplaced.has(entity.id);
    graph.addNode(entity.id, {
      x: position.x,
      y: position.y,
      // `log1p(0)` is 0, so a node of degree 0 takes the floor.
      size: sizeSpan === 0 ? SIZE_FLOOR : SIZE_FLOOR + (Math.log1p(degree) / sizeSpan) * SIZE_RANGE,
      color: hueOfNode(
        { isolate, entityType: entity.type, unplaced: unplacedNode },
        palette,
        hueOfType,
        ground,
      ),
      label: entity.label,
      entityType: entity.type,
      type: entity.type in GLYPHS ? entity.type : 'unknown',
      // The corpus holds promoted evidence only, and a proposal is not an entity of the graph.
      candidate: false,
      degree,
      isolate,
      unplaced: unplacedNode,
    });
  }

  for (const relation of edges) {
    graph.addDirectedEdgeWithKey(relation.id, relation.srcId, relation.dstId, {
      size: 1,
      color: familyHue(familyOf(relation.type), ground),
      type: familyOf(relation.type),
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

  return {
    setGround: (next) => {
      hueOfType.clear();
      for (const [key, hue] of typeHues(types, next)) hueOfType.set(key, hue);
      graph.forEachNode((id, attrs) => {
        graph.setNodeAttribute(id, 'color', hueOfNode(attrs, paletteOf(next), hueOfType, next));
      });
      graph.forEachEdge((id, attrs) => {
        graph.setEdgeAttribute(id, 'color', familyHue(attrs.type, next));
      });
    },
    graph,
    pendingByTarget,
    hueOfType,
    labelOfType: (type) => typeLabel(type, types),
    hierarchy: unitHierarchy(corpus.relations, new Set(graph.nodes())),
  };
}
