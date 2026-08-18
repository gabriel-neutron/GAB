/**
 * The graph, and what is attached to it.
 *
 * Built from `docs/graph-surface.md` §4.2, §3.3, §3.4, §4.5 and §8 step 2. It takes the read, the
 * positions and one palette, and it returns one typed graph, the macro reads of `./structure`,
 * three indexes.
 *
 * **The legend is gone** — #82 rows B1 to B11, Never asked for it. `legendDefinitions`,
 * `legendCounts`, `LegendDefinition`, `LegendCount` and `LegendToken` left this file with it, and
 * #76 holds the reason. Nothing on the graph now states what the paint means: **#87
 * GRAPH-COLOUR-RULE** owns that question.
 *
 * **It computes no position.** `positions` is the seam of **#35**, which is OPEN. §3.2 measured
 * two layouts of one corpus: the displacement is about half the width of the picture, and
 * convergence does not repair it, so a browser layout gives a different picture on every open.
 * This file therefore imports no layout package, and it guesses nothing about where a position
 * is held or what a position carries. It reads a map that the caller gives it, and no more.
 *
 * **An entity with no position is dropped, and each loss is counted with a name of its own.** A
 * surface that drops evidence in silence is worse than one that says how much it dropped — §3.3.
 * A count that carries two losses cannot be read, so each loss has one count.
 *
 * **The node shape and the edge shape are declared.** §4.2: the graphology default is an index
 * signature of `any`, and a read from it makes an unsafe assignment that nobody may suppress
 * (ADR 0004 §8).
 *
 * **Every colour is `#rrggbb`.** §4.2: Sigma parses hex and `rgb()` on the CPU, and an `hsl()`
 * colour comes out black, for the whole graph, in silence. `CANVAS.md` adds the second half: a
 * CSS custom property never reaches that parser, so the hues of `src/index.css` are copied here
 * as hex. **This is the second copy**, and it is a recorded cost. `src/features/map/projection.ts`
 * holds the first one, for the map. A feature never imports a feature (ADR 0001 §1), so the two
 * copies cannot become one until the operator lifts the hues into `shared/`. A copy that drifts
 * is worse than a lookup.
 *
 * **Two palettes, and this file reads neither theme.** The map uses the dark set on every ground,
 * because a point sits on imagery (`CANVAS.md`). **A Sigma canvas has no imagery**: its ground is
 * the container, which is `--background`, and that is near-white in the light theme. The dark
 * entity hues give about 2.2:1 on it, so every node fails the 3:1 that `src/index.css` asks of a
 * mark a person must see. So each theme carries its own record in `GRAPH_PALETTES`, and the
 * caller states which one. **The swap belongs to the `controller` of §4.3**, with the observer on
 * the class of `documentElement` that `CANVAS.md` requires. A derivation reads no class and
 * observes nothing, so this file stays pure.
 */

import { MultiDirectedGraph } from 'graphology';

import type { Corpus, Proposal, Relation } from '@/shared/fixtures/types';

import { analyseStructure, topologyOf } from './structure';

/**
 * Where one node is drawn. **The seam of #35, and nothing more.**
 *
 * It carries no identity of a layout run, because §3.2 leaves that to #35 and this file settles
 * no open question.
 */
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
  readonly community: number;
  readonly degree: number;
  readonly isolate: boolean;
}

/** What is attached to one edge. One edge is one relation that both endpoints can carry. */
export interface EdgeAttrs {
  readonly size: number;
  readonly color: string;
  readonly relationType: string;
  /** M6: an interval is written at both ends, so both ends are carried. */
  readonly validFrom: string | null;
  readonly validTo: string | null;
}

/**
 * Every colour the canvas paints, for one ground. Each one is `#rrggbb`, because Sigma parses
 * hex on the CPU and an `hsl()` colour comes out black in silence — §4.2.
 */
export interface GraphPalette {
  /** The six entity hues, in order. They **cycle**: see `hueOf`. */
  readonly communities: readonly [string, string, string, string, string, string];
  readonly isolate: string;
  readonly edge: string;
}

/** Which ground the canvas has. The light theme is on `:root`, the dark theme on `.dark`. */
export type GraphGround = 'light' | 'dark';

/**
 * `readonly` is a promise to the compiler, and `Object.freeze` is a lock at run time. This value
 * is one module object that every build of the model shares, so an importer that writes into it
 * changes the paint of every later build in silence. The freeze reaches the list of hues too.
 */
const freeze = (palette: GraphPalette): GraphPalette =>
  Object.freeze({ ...palette, communities: Object.freeze(palette.communities) });

/**
 * The palettes, converted from the `oklch` values of `src/index.css` to hex.
 *
 * Each ratio below is against `--background` of the same theme, and `src/index.css` asks 3:1 of a
 * mark that a person must see.
 *
 * - `communities`: `--entity-1` to `--entity-6`. 4.6:1 to 5.0:1 on the light ground, 7.9:1 to
 *   8.9:1 on the dark ground.
 * - `isolate`: `--muted-foreground`, 8.6:1 and 8.7:1. An isolate is out of the structure, so it
 *   is grey, and it stays legible.
 * - `edge`: `--label`, 5.6:1 on each ground. The `--border` hue gives 1.5:1 on the dark ground
 *   and no reader sees a relation painted with it.
 */
export const GRAPH_PALETTES: Readonly<Record<GraphGround, GraphPalette>> = Object.freeze({
  light: freeze({
    communities: ['#2971c6', '#007989', '#007d50', '#677000', '#a16100', '#b53c7f'],
    isolate: '#42494c',
    edge: '#5e6468',
  }),
  dark: freeze({
    communities: ['#70adfb', '#00c2d2', '#53c48e', '#a8b44b', '#df9b44', '#e887b6'],
    isolate: '#a9afb1',
    edge: '#848a8c',
  }),
});

/** One byte as two hex digits, so that a colour of this file keeps the `#rrggbb` shape. */
const hexPair = (value: number): string => value.toString(16).padStart(2, '0');

/**
 * The same hue, at a low opacity. **A dim invents no colour**, so a dimmed element never reads as
 * an isolate, which is the one hue this file gives a meaning.
 *
 * **This file holds it because this file owns the format.** `controller.ts` parsed the `#rrggbb`
 * shape that the palettes above promise, so the promise and the parser sat in two files and a
 * change of the format would reach one of them only.
 *
 * **The result is opaque, and that is the whole point of it.**
 *
 * **The defect this replaces.** The dim was an `#rrggbbaa` colour, 40 % on the dark ground. A
 * translucent node lets through everything under it, and the relations are drawn under the nodes:
 * the operator saw **the ends of the lines inside the dots**, and this canvas drew a see-through
 * dot where the map drew a solid one. A dim is a change of **appearance**, and never a hole.
 *
 * So the hue is composited over the colour of the page here, and the answer is a plain `#rrggbb`
 * that looks dimmed and hides what is behind it. **Do not go back to an alpha channel**: the two
 * canvases disagree again, and every line end shows through.
 */
export const dimmedColour = (colour: string, ground: string, fraction: number): string => {
  if (colour.length !== 7 || !colour.startsWith('#')) return colour;
  const value = Number.parseInt(colour.slice(1), 16);
  const under = Number.parseInt(ground.slice(1), 16);
  if (Number.isNaN(value) || Number.isNaN(under)) return colour;
  // The hue at `fraction`, over the page at the rest. Both are opaque, so the answer is opaque.
  const mix = (shift: number): number =>
    Math.round(((value >> shift) & 0xff) * fraction + ((under >> shift) & 0xff) * (1 - fraction));
  return `#${hexPair(mix(16))}${hexPair(mix(8))}${hexPair(mix(0))}`;
};

/**
 * The colour of the page, per ground, as hex.
 *
 * **It is a copy of `--background` of `src/index.css`**, converted from `oklch`, for the same
 * reason the palettes above are: a CSS custom property never reaches the Sigma parser. It is here
 * and not in `controller.ts`, because this file owns every colour value the canvas is given.
 */
export const GROUND_HUE: Readonly<Record<GraphGround, string>> = Object.freeze({
  light: '#f7f8f9',
  dark: '#0b1013',
});

/**
 * What the canvas needs, and nothing more.
 *
 * **Nine members left this shape**, and each one was read by nobody. `structure`,
 * `relationsByEndpoint`, `m4RelationsByEndpoint`, `entitiesDrawn`, `relationsDrawn`,
 * `m4Relations`, `relationsWithoutEndpoint`, `duplicateEntities` and `duplicateRelations` were
 * built at every model and never read: six of them were build diagnostics that the legend drew,
 * and the legend is gone — #82 B1 to B11. The two indexes were declared for a reach the surface
 * never made.
 *
 * **The behaviour they measured is unchanged.** A duplicate row is still dropped, a relation with
 * no endpoint is still left out, an M4 relation is still kept off the canvas, and an entity with
 * no position is still absent. **Nothing counts any of them any more**, and no surface reports
 * them: **#35** owns what a surface does with what it cannot place.
 */
export interface GraphModel {
  readonly graph: MultiDirectedGraph<NodeAttrs, EdgeAttrs>;
  /** UC5: the pending proposals, under the identifier of the element that can carry a marker. */
  readonly pendingByTarget: ReadonlyMap<string, readonly Proposal[]>;
}

/**
 * The hue of one community. **The six hues cycle**, so community 0 and community 6 wear one hue.
 * A hue is therefore the encoding "these entities connect", and never the identity of one
 * community. So a hue says "these entities connect" and it names nobody.
 *
 * **Nothing on the screen states that any more.** The legend that said it is gone — #82 B2. **#87
 * GRAPH-COLOUR-RULE** owns whether this colouring carries information at all, and whether a reader
 * learns its meaning somewhere else. This file assumes no answer: it paints, and it explains
 * nothing.
 */
const hueOf = (palette: GraphPalette, community: number): string =>
  palette.communities[community % palette.communities.length] ?? palette.communities[0];

/**
 * The radius of a node of degree 0, in the units Sigma scales to pixels.
 *
 * **The floor is the smallest shape that a person can find and click, and it is not the smallest
 * number the scale allows.** 1.6 came from the prototype, which drew ten thousand nodes at a zoom
 * where 1.6 was a shape; at twenty-seven entities it drew one pale pixel, and UC1 asks for an
 * outlier to be **found** with no label read. A node of degree 0 is an isolate, which is exactly
 * the node this floor decides.
 *
 * **No ticket owns this number, and it guesses at no open question.** §4.2 gives the rule, "size
 * by degree", so the shape is decided and the range alone is chosen: this is a tuning value.
 */
const SIZE_FLOOR = 4;

/**
 * How much larger the largest hub is than a leaf. The floor plus this range is the top radius, so
 * a hub is about three times the radius of an isolate and about nine times its area.
 *
 * **The scale is normalised by the span of the graph, and never by a constant.** The range of the
 * degree grows with the corpus, so a constant multiplier gives one size to every node at ten
 * thousand entities and a picture of dots at twenty-seven. `structure.largestDegree` carries the
 * top of the range, so the same range holds for each corpus.
 *
 * **No ticket owns this number either**, and for the reason the floor above gives: §4.2 gives the
 * rule and only the range is chosen.
 */
const SIZE_RANGE = 9;

/** The one relation this graph can draw: an entity at each end, and a node for each of the two. */
const isDrawable = (relation: Relation, drawn: ReadonlySet<string>): boolean =>
  relation.srcKind === 'entity' &&
  relation.dstKind === 'entity' &&
  drawn.has(relation.srcId) &&
  drawn.has(relation.dstId);

/** M4: a relation that names a relation at one end or at the other. §4.2 keeps it off the edges. */
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
    // An entity with no position is absent from the graph. Nothing counts it any more — #35.
    if (!positions.has(entity.id)) continue;
    // The read comes from outside. A repeated identifier makes `addNode` throw, and an exception
    // here takes the canvas with it. So the second row is dropped, in silence.
    drawn.add(entity.id);
  }

  // **An M4 relation names a relation, so it has no node at one end and the canvas never draws
  // it** — §4.2 and ADR 0004 §4. It is dropped here, and no index holds it any more: the index
  // that did was read by nobody.
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

  // The topology of §4.1, built by `./structure`, which declares the shape. The structure is
  // needed for the paint, and the paint is needed for the first node, so the reads come before
  // the graph exists. `edges` already holds an entity at each end, and both are drawn.
  const topology = topologyOf(
    drawn,
    edges.map((relation) => ({ source: relation.srcId, target: relation.dstId })),
  );
  const structure = analyseStructure(topology);

  const isolates = new Set(structure.isolates);

  // The span of the size ramp, in the same logarithm the size below uses. A graph where every
  // node is an isolate has a span of 0, and each node then takes the floor: a division by 0 would
  // make each size `Infinity` or `NaN`, and Sigma draws nothing for either.
  const sizeSpan = Math.log1p(structure.largestDegree);

  const graph = new MultiDirectedGraph<NodeAttrs, EdgeAttrs>();
  for (const entity of corpus.entities) {
    const position = positions.get(entity.id);
    if (position === undefined || graph.hasNode(entity.id)) continue;

    const community = structure.community.get(entity.id) ?? 0;
    const degree = topology.degree(entity.id);
    const isolate = isolates.has(entity.id);
    graph.addNode(entity.id, {
      x: position.x,
      y: position.y,
      // §4.2 sizes by the degree. The logarithm holds a hub of two thousand relations beside a
      // node of two, which a linear size cannot do, and the span of the graph normalises it so
      // that a hub reads as a hub beside a leaf at each size of corpus — UC1. `log1p(0)` is 0, so
      // a node of degree 0 takes the floor.
      size: sizeSpan === 0 ? SIZE_FLOOR : SIZE_FLOOR + (Math.log1p(degree) / sizeSpan) * SIZE_RANGE,
      color: isolate ? palette.isolate : hueOf(palette, community),
      label: entity.label,
      entityType: entity.type,
      community,
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

  // A marker of UC5 needs an element to sit on. A node is drawn, and a relation that became an
  // edge is drawn. Anything else carries no marker, and it is counted instead — §3.3.
  const pendingByTarget = new Map<string, Proposal[]>();
  for (const proposal of corpus.proposals) {
    if (proposal.status !== 'pending') continue;
    const target = proposal.targetId;
    if (target === null || proposal.targetKind === null) continue;
    const carried = proposal.targetKind === 'entity' ? drawn.has(target) : edgeKeys.has(target);
    if (carried) hold(pendingByTarget, target, proposal);
  }

  return { graph, pendingByTarget };
}
