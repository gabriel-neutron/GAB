import { canvasTheme, observeCanvasTheme } from '@/shared/canvas-theme';
import Sigma from 'sigma';
import type { Coordinates, EdgeDisplayData, NodeDisplayData } from 'sigma/types';

import { canvasLabelTransform } from '@/shared/canvas-label';
import type { Corpus, EntityPosition, TypeVocabulary } from '@/shared/read/model';
import { relationWording } from '@/shared/relation-words';
import { foldEveryUnit } from '@/shared/unit-folds';

import { createDashedArrowProgram } from './dashed-edge-program';
import { glyphSvg } from './glyph-svg';
import { GLYPHS } from './glyphs';
import { createGlyphProgram, setGround } from './glyph-node-program';
import { FARTHEST_RATIO, NEAREST_RATIO, restorableCamera } from './camera-bounds';
import { edgeRing, hopDistances } from './hop-distance';
import {
  buildGraphModel,
  dimmedColour,
  groundHue,
  type EdgeAttrs,
  type GraphGround,
  type GraphModel,
  type NodeAttrs,
  type NodePosition,
} from './model';
import { createLiveLayout } from './live-layout';
import { morph } from './morph';
import { layoutInput } from './layout-weights';
import { DEFAULT_VARIANT, variantOf, type Variant, type VariantId } from './variants';
import { graphPositions } from './positions';
import { FAMILIES, lookOf } from './relation-families';
import { type RelationFilterState } from './relation-filter';
import { readSelectionAddress, writeSelectionAddress, type GraphSelection } from './selection';
import { countShown, type ShownCounts } from './shown-counts';
import { describeDrawing, deriveTextView } from './text-view';
import { isShown, type FilterState } from './type-filter';
import { patchGraphWorkspace, readGraphWorkspace } from './workspace';

export interface GraphView {
  readonly selection: GraphSelection | null;
  readonly filter: FilterState;
  /** The relation types that the legend switches off. */
  readonly relationFilter: RelationFilterState;
  readonly lit: number;
  readonly dimmed: number;
  /** What the drawing shows against what the record holds: the nodes the filter keeps. */
  readonly counts: ShownCounts;
  /** How many elements carry a marker, and how many carry pending evidence and none. */
  readonly markersDrawn: number;
  readonly markersOverCap: number;
  /** The units whose subordinates the rail list shows. The canvas draws each unit either way. */
  readonly openUnits: ReadonlySet<string>;
  /** How many entities have no place, and the canvas draws on the ring. */
  readonly unplaced: number;
  /** Whether the canvas draws them. */
  readonly showUnplaced: boolean;
  /** The identifier of the prototype in view. */
  readonly variant: VariantId;
  readonly railOpen: boolean;
  readonly railWidth: number;
}

export interface GraphController {
  readonly model: GraphModel;
  /** Selects the entity, as a click on it does, and moves the camera to it and its neighbours. */
  readonly select: (id: string) => void;
  /** Selects a relation, as a click on it does. The camera stays. */
  readonly openRelation: (id: string) => void;
  readonly setUnitOpen: (unit: string, open: boolean) => void;
  readonly setFilter: (patch: Partial<FilterState>) => void;
  /** Hides or draws the relations of the types the patch names. */
  readonly setRelationFilter: (patch: Partial<RelationFilterState>) => void;
  /** Draws or hides the entities that stand on the ring with no place. */
  readonly setShowUnplaced: (show: boolean) => void;
  /** Switches the prototype of the graph: the weights, the forces and the sizes. */
  readonly setVariant: (id: VariantId) => void;
  /** The rail was unfolded or folded. The workspace keeps it, so the next open finds it there. */
  readonly setRailOpen: (open: boolean) => void;
  /** The rail edge was dragged. The workspace keeps the width, as it keeps the fold. */
  readonly setRailWidth: (width: number) => void;
  /** Ends the selection, as a click on the ground does. The camera stays. */
  readonly clearSelection: () => void;
  /** A phone sheet covers this many pixels at the foot of the canvas. The camera keeps the
   * selection in the part above it. */
  readonly setBottomInset: (pixels: number) => void;
  /** Zooms the camera one step, in or out. */
  readonly zoom: (direction: 'in' | 'out') => void;
  readonly subscribe: (listener: (view: GraphView) => void) => () => void;
  /** The selection alone. A fold of the rail publishes a view and calls no listener of this. */
  readonly onSelect: (listener: (selection: GraphSelection | null) => void) => () => void;
  readonly destroy: () => void;
}

// 1000 is the cap on markers. A marker is a page element placed over its element on every frame,
// so the cost is linear and it runs in the render loop. Measured at ten thousand entities: 1500
// holds 60 Hz, 2000 misses every frame, and 4000 runs at 19 fps. This is half of the wall.
const MARKER_CAP = 1000;

// The camera leaves this much room around the nodes it fits, as a factor of their extent.
const FIT_MARGIN = 1.6;

// The camera counts the canvas as at most this much wider than it is high, so a fit on a wide
// canvas keeps room above and below the nodes. Origin: invented; the island is 32 rem high and about 44 rem wide.
const MAX_ASPECT = 1.7;

// A name is a page element, as a marker is. Origin: tuned on a screen. Above about fifteen, the
// names of a hub cover each other and none can be read, so a hub names its most connected
// neighbours. A hover still names each node.
const NAME_CAP = 15;

// The space between a node and its name, beside the radius of the node, in pixels.
const NAME_OFFSET = 4;

// The selection is named at 14px in `foreground`, and a one-hop neighbour at 12px in
// `muted-foreground`.
const NAME_CLASS = 'pointer-events-none absolute top-0 left-0 max-w-48 truncate bg-background px-1';
const SELECTED_NAME = `${NAME_CLASS} text-body-sm text-foreground`;
const NEIGHBOUR_NAME = `${NAME_CLASS} text-caption text-muted-foreground`;

// A selection never takes the camera nearer than this ratio, so a node with no neighbour keeps
// the graph around it in view. Origin: invented, a quarter of the whole picture.
const SELECT_RATIO = 0.25;

// The dim keeps this much of the colour, from the design system: a node outside the selection and
// its first ring keeps 30%, a relation 25%. The colour is mixed with the ground and the hue never
// changes. The mix is opaque, because the relations are drawn under the nodes.
const DIM_NODE = 0.3;
const DIM_EDGE = 0.25;

// The camera of Sigma reports `updated` on every frame of a pan, and a `localStorage` write on
// every frame blocks the main thread. So the store is a trailing wait, and `destroy` writes the
// camera that is still waiting.
const CAMERA_STORE_WAIT = 250;

/** The size that stands for "this file has used no size yet". A box is never negative. */
const NO_SIZE = -1;

/** How far outside the canvas an overlay element may sit before it is not drawn, in pixels. */
const OVERLAY_MARGIN = 32;

const LAYER_CLASS = 'pointer-events-none absolute inset-0 overflow-hidden';

// The mark is a page element and not a node program: a node program is a WebGL program, a shader
// pair and a buffer layout. The cost of the page element is the cap above.
const MARKER_CLASS =
  'pointer-events-none absolute top-0 left-0 size-2 rounded-none border border-background bg-candidate';

// The hover card of the design system: `surface`, a 1px `border`, `radius-sm`, the hairline.
const CARD_CLASS = [
  'pointer-events-none absolute top-0 left-0 z-10 flex w-70 flex-col gap-1 rounded-sm',
  'border border-border bg-surface p-2 text-foreground shadow-hairline',
].join(' ');
const CARD_DELAY_MS = 120;

// A fixed offset, and not a fraction of the radius: a hub of two thousand relations would push
// its badge far out into the picture, and a leaf would keep the badge on top of itself.
const MARKER_OFFSET = 7;

// The ring is never drawn with the `highlighted` flag of Sigma: that flag makes the library draw
// its own hover card, in colours that no token of this repository reaches.
const RING_CLASS = 'pointer-events-none absolute top-0 left-0 rounded-full border-2 border-ring';

/** How much larger the ring is than the node it names, in pixels of diameter: 6px outside. */
const RING_MARGIN = 12;

/** The diameter of the ring that names a selected relation, in pixels. A relation has no radius. */
const RING_ON_RELATION = 12;

/** The unsubscribe that a destroyed handle gives. */
const NO_OP = (): void => {
  // A destroyed handle registers no listener, so it has nothing to remove.
};

// A state change of the camera takes at most this long. Origin: the 120 ms limit of the motion
// rule. A reader who asks for no motion gets a jump.
const MOTION_MS = 120;

// External constraint: the user agent tells the choice of the reader here, and a media query is
// the one way to read it.
const motionOf = (): number =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : MOTION_MS;

const sameSelection = (one: GraphSelection | null, two: GraphSelection | null): boolean =>
  one === null || two === null ? one === two : one.kind === two.kind && one.id === two.id;

/** Two hidden sets are the same set while they hold the same names in the same order. */
const sameTypes = (one: readonly string[], two: readonly string[]): boolean =>
  one.length === two.length && one.every((type, index) => type === two[index]);

// React invokes an effect two times in development, and a second instance on one element makes
// the browser drop the older WebGL context. That looks like a blank canvas. So a second mount
// destroys the first, and `destroy` removes the entry it owns and no other.
const mounted = new WeakMap<HTMLElement, GraphController>();

export function mountGraph(
  canvas: HTMLElement,
  overlay: HTMLElement,
  corpus: Corpus,
  layout: ReadonlyMap<string, EntityPosition>,
  types: TypeVocabulary,
): GraphController {
  mounted.get(canvas)?.destroy();
  let ground: GraphGround = canvasTheme();

  // **The positions are read one time.** A filter never moves a position, and an entity the
  // layout run did not place must stand in one place while the canvas lives. So nothing below
  // builds them again, and a theme change keeps them.
  const placement = graphPositions(corpus.entities, layout, corpus.relations);
  const positions = placement.positions;

  // External constraint: Sigma divides by the duration, so a duration of 0 makes the camera NaN
  // for one frame. The three settings below take at least 1 ms, and a call that must jump sets the
  // state itself.
  const settingMs = Math.max(1, motionOf());
  const model = buildGraphModel(corpus, positions, types, ground, placement.unplaced);
  const wordsOf = relationWording(corpus.relationTypes);

  const stored = readGraphWorkspace();
  let filter: FilterState = { hiddenTypes: [...stored.hiddenTypes] };
  let hidden = new Set(filter.hiddenTypes);
  let relationFilter: RelationFilterState = {
    hiddenRelationTypes: [...stored.hiddenRelationTypes],
  };
  let hiddenRelations = new Set(relationFilter.hiddenRelationTypes);
  let railOpen = stored.railOpen;
  let railWidth = stored.railWidth;
  let showUnplaced = stored.showUnplaced;
  let variant: Variant = DEFAULT_VARIANT;

  // The stored picture is the frame. The camera fits are computed in this frame, so it is fixed
  // here and given to Sigma, and the two never differ.
  const frame = (() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const { x, y } of positions.values()) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    if (minX > maxX) return { x: [0, 1] as [number, number], y: [0, 1] as [number, number] };
    return { x: [minX, maxX] as [number, number], y: [minY, maxY] as [number, number] };
  })();
  const frameSpan = Math.max(frame.x[1] - frame.x[0], frame.y[1] - frame.y[0], Number.EPSILON);
  const frameX = (frame.x[0] + frame.x[1]) / 2;
  const frameY = (frame.y[0] + frame.y[1]) / 2;

  // Departure: the open units die with the canvas. A fold is a step of one reading, and every
  // unit starts closed, so an open always lists the tops of the hierarchy first.
  const hierarchy = model.hierarchy;
  const folds = foldEveryUnit(hierarchy);

  let destroyed = false;
  const listeners = new Set<(view: GraphView) => void>();
  const selectListeners = new Set<(selection: GraphSelection | null) => void>();

  // The elements the filter keeps lit, and the elements the two hops of a selection keep lit.
  const litNodes = new Set<string>();
  const litEdges = new Set<string>();
  // The hop distance of each node that a selection reaches, and the relations from the first ring
  // to the second, which draw fainter than the relations of the selection.
  let hopOf: ReadonlyMap<string, number> = new Map();
  const faintEdges = new Set<string>();
  let lit = 0;
  let dimmed = 0;
  let counts: ShownCounts = countShown(model.graph, new Set(), hiddenRelations);

  /** The elements that carry a marker on this frame, and how many get none. */
  let markerTargets: readonly string[] = [];
  let markersOverCap = 0;

  // The hover is not on the view and it never publishes: a hover changes as fast as the pointer
  // moves, and a publish on each one would run every subscriber of this handle at that rate.
  interface HoverCard {
    readonly id: string;
    /** The type of an entity, for the glyph, or `null` for a relation. */
    readonly type: string | null;
    readonly eyebrow: string;
    readonly name: string;
    /** Two rows at most: a key and its value. */
    readonly rows: readonly (readonly [string, string])[];
  }
  let hovered: HoverCard | null = null;
  // Measured once when the card opens: a read of the width on each frame forces a layout.
  let cardHalfWidth = 0;

  // A reducer runs for each element on each frame, so a dimmed colour is computed one time.
  const dimCache = new Map<string, string>();
  const dimEdgeCache = new Map<string, string>();
  // The page colour as hex, read from the token of the theme in force.
  let groundColour = groundHue(ground);
  setGround(groundColour);
  const mixOf = (cache: Map<string, string>, colour: string, alpha: number): string => {
    const held = cache.get(colour);
    if (held !== undefined) return held;
    const made = dimmedColour(colour, groundColour, alpha);
    cache.set(colour, made);
    return made;
  };
  const dimOf = (colour: string): string => mixOf(dimCache, colour, DIM_NODE);
  const dimEdgeOf = (colour: string): string => mixOf(dimEdgeCache, colour, DIM_EDGE);

  // The test is on the dim of the filter, and not on the dim of a selection. The two hops of a
  // selection dim as well, and they must not stop a click on a node on the other side.
  const passesFilter = (attrs: NodeAttrs): boolean => isShown(attrs, hidden, showUnplaced);

  const nodeConsidered = (node: string): boolean =>
    model.graph.hasNode(node) && passesFilter(model.graph.getNodeAttributes(node));

  /** A relation of a type that the legend switches off is not drawn, and it joins nothing. */
  const typeShown = (edge: string): boolean =>
    !hiddenRelations.has(model.graph.getEdgeAttribute(edge, 'relationType'));

  /** A relation is in consideration while both of its endpoints are, and its type is on. */
  const edgeConsidered = (edge: string): boolean =>
    model.graph.hasEdge(edge) &&
    typeShown(edge) &&
    nodeConsidered(model.graph.source(edge)) &&
    nodeConsidered(model.graph.target(edge));

  let selection: GraphSelection | null = null;

  // Without this, the marker, the ring and the detail all keep working on an element that the
  // filter puts out of consideration.
  const acceptable = (candidate: GraphSelection | null): GraphSelection | null => {
    if (candidate === null) return null;
    if (candidate.kind === 'entity') return nodeConsidered(candidate.id) ? candidate : null;
    return edgeConsidered(candidate.id) ? candidate : null;
  };

  // A relation is selected, so both of the elements it joins are the seeds of the walk.
  const seedsOf = (chosen: GraphSelection | null): readonly string[] => {
    if (chosen === null) return [];
    if (chosen.kind === 'entity') return [chosen.id];
    if (!model.graph.hasEdge(chosen.id)) return [];
    return [model.graph.source(chosen.id), model.graph.target(chosen.id)];
  };

  /** The selection and its first ring, the nodes the camera fits and the canvas names. */
  const nearOf = (): string[] => [...hopOf].filter(([, hop]) => hop <= 1).map(([node]) => node);

  /** The names the canvas draws: the selection, then the first ring by degree, to the cap. */
  let shownNames: readonly string[] = [];

  function nameReach(): void {
    const degreeOf = (node: string): number => model.graph.getNodeAttribute(node, 'degree');
    shownNames = nearOf()
      .sort(
        (one, two) =>
          (hopOf.get(one) ?? 0) - (hopOf.get(two) ?? 0) ||
          degreeOf(two) - degreeOf(one) ||
          one.localeCompare(two),
      )
      .slice(0, NAME_CAP);
    sizeLabelPool(names, shownNames.length, NEIGHBOUR_NAME);
    shownNames.forEach((node, index) => {
      const element = names[index];
      if (element === undefined) return;
      element.className = hopOf.get(node) === 0 ? SELECTED_NAME : NEIGHBOUR_NAME;
      const label = model.graph.getNodeAttribute(node, 'label');
      element.textContent = label;
      element.title = label;
    });
  }

  const recount = (): void => {
    const passes = new Set<string>();
    model.graph.forEachNode((node, attrs) => {
      if (passesFilter(attrs)) passes.add(node);
    });

    // Without a selection the filter lights every node it keeps. A selection lights its two hops.
    hopOf = hopDistances(model.graph, seedsOf(selection), passes, typeShown);
    litNodes.clear();
    litEdges.clear();
    faintEdges.clear();
    for (const node of passes) {
      if (hopOf.size === 0 || hopOf.has(node)) litNodes.add(node);
    }
    model.graph.forEachEdge((edge, _attrs, source, target) => {
      if (!litNodes.has(source) || !litNodes.has(target) || !typeShown(edge)) return;
      if (hopOf.size === 0) {
        litEdges.add(edge);
        return;
      }
      const ring = edgeRing(hopOf.get(source) ?? 0, hopOf.get(target) ?? 0);
      if (ring === 'dim') return;
      litEdges.add(edge);
      if (ring === 'faint') faintEdges.add(edge);
    });

    counts = countShown(model.graph, passes, hiddenRelations);
    lit = litNodes.size + litEdges.size;
    dimmed = model.graph.order + model.graph.size - lit;

    // **A marker sits on a lit element only.** A marker over an element that the analyst excluded
    // states pending evidence about an element that is out of consideration.
    const targets: string[] = [];
    for (const target of model.pendingByTarget.keys()) {
      if (litNodes.has(target) || litEdges.has(target)) targets.push(target);
    }
    // The rank is the count of pending proposals, so the cut keeps the elements where the evidence
    // is thickest. The identifier is the tie-break: a relation carries a marker and holds no
    // degree, and the same corpus must give the same set on every open.
    const weightOf = (target: string): number => model.pendingByTarget.get(target)?.length ?? 0;
    targets.sort((one, two) => weightOf(two) - weightOf(one) || one.localeCompare(two));

    markerTargets = targets.slice(0, MARKER_CAP);
    markersOverCap = targets.length - markerTargets.length;
    sizeMarkerPool(markerTargets.length);

    nameReach();
  };

  // Where each node was drawn when its last move began, as the card reads it. The place that Sigma
  // holds now is where the move ends.
  const moves = new Map<string, { fromX: number; fromY: number }>();
  // A reducer replaces the datum and does not merge into it. Each one below spreads the original,
  // or Sigma finds no `x` and no `y` and refuses the node with an error.
  const reduceNode = (node: string, data: NodeAttrs): Partial<NodeDisplayData> => {
    // The switch hides the ring. Unlike a filter, it takes the node out of the picture.
    if (!showUnplaced && data.unplaced) return { ...data, hidden: true, label: null };
    if (litNodes.has(node)) {
      const hop = hopOf.get(node);
      // The ring at two steps can hold most of the graph, through a legal act that lists
      // hundreds of entities. So it dims as the rest does, and the direct neighbours stand out.
      if (hop === 2) return { ...data, color: dimOf(data.color), zIndex: 1 };
      if (hop === 1) return { ...data, zIndex: 2 };
      return { ...data, zIndex: hop === 0 ? 3 : 0 };
    }
    // A type that the filter puts out leaves the picture. A selection only dims the rest.
    if (!passesFilter(data)) return { ...data, hidden: true, label: null };
    return { ...data, color: dimOf(data.color), label: null };
  };

  const sigma = new Sigma<NodeAttrs, EdgeAttrs>(model.graph, canvas, {
    // The container is measured in the constructor, while the chrome around it is still built.
    // A container of no height throws here. The `ResizeObserver` below gives the true size at the
    // first delivery, so a container that is not laid out yet is not a fault.
    allowInvalidContainer: true,
    // The reducer puts the selection and its direct neighbours over the other nodes.
    zIndex: true,

    // This canvas is for macro structure, and not for reading labels. The
    // label colour of the library is one fixed value that no token of this repository reaches, so
    // a label drawn here is unreadable on one of the two grounds.
    renderLabels: false,

    // `renderLabels: false` does not reach the hover card of Sigma: the card is drawn by its own
    // path, in one fixed colour, and it put black text on a white box over this canvas.
    defaultDrawNodeHover: () => undefined,

    // Sigma reads the edge program from the `type` of an edge, and this default reaches every
    // edge that states none, so no edge datum and no reducer below changes.
    defaultEdgeType: 'other',
    // One node program for each glyph, and the `type` of a node names it. The shape carries the
    // type of the entity, and the hue confirms it.
    defaultNodeType: 'unknown',
    nodeProgramClasses: Object.fromEntries(
      Object.keys(GLYPHS).map((key) => [key, createGlyphProgram(key)]),
    ),
    // One program for each family, and the `type` of an edge names it. The programs differ by
    // the dash pattern alone, so the difference of the families also works without colour.
    edgeProgramClasses: Object.fromEntries(
      FAMILIES.map((family) => [family.key, createDashedArrowProgram(family.dash)]),
    ),

    // A relation is selected on the canvas, so a relation takes a click: the selection carries
    // `kind: 'relation'`, and the route draws that case as a report. This is not the case the
    // graph cannot draw: an M4 relation has no edge here, so no click can reach it.
    enableEdgeEvents: true,

    // Departure: at 10 the band was 10px, and on a corpus of three thousand entities the edges
    // and their arrows covered the nodes. A relation is also reachable from its two nodes.
    minEdgeThickness: 1,

    // The workspace carries `x`, `y` and `ratio`, and no angle. A rotation that the store
    // cannot carry would be lost at the reload, and the analyst would meet a picture that is not
    // the one that was left.
    enableCameraRotation: false,

    // The three gestures that animate the camera take the same short time as a call of the
    // controller. The defaults are 200 to 250 ms, and the motion rule allows 120.
    zoomDuration: settingMs,
    doubleClickZoomingDuration: settingMs,
    inertiaDuration: settingMs,

    // External constraint: Sigma bounds no zoom by default, so a wheel or a pinch can reach a
    // ratio where the canvas shows empty ground. Sigma applies these bounds to each camera state.
    minCameraRatio: NEAREST_RATIO,
    maxCameraRatio: FARTHEST_RATIO,

    nodeReducer: (node: string, data: NodeAttrs): Partial<NodeDisplayData> => ({
      ...reduceNode(node, data),
      ...moves.get(node),
    }),

    edgeReducer: (edge: string, data: EdgeAttrs): Partial<EdgeDisplayData> => {
      // A relation type that the legend switches off is out of the picture, as the ring is when
      // its switch is off: a hidden edge cannot be clicked, and no dim stands in its place.
      if (hiddenRelations.has(data.relationType)) return { ...data, hidden: true, label: null };
      if (
        !showUnplaced &&
        model.graph.extremities(edge).some((end) => model.graph.getNodeAttribute(end, 'unplaced'))
      ) {
        return { ...data, hidden: true, label: null };
      }
      if (faintEdges.has(edge)) return { ...data, color: dimEdgeOf(data.color) };
      // 2px where the edge touches the selection, 1px at rest.
      if (litEdges.has(edge)) {
        const touches =
          (selection?.kind === 'relation' && selection.id === edge) ||
          hopOf.get(model.graph.source(edge)) === 0 ||
          hopOf.get(model.graph.target(edge)) === 0;
        return { ...data, size: touches && hopOf.size > 0 ? 2 : 1 };
      }
      // A line whose end the filter puts out has nothing to join.
      if (
        model.graph
          .extremities(edge)
          .some((end) => !passesFilter(model.graph.getNodeAttributes(end)))
      ) {
        return { ...data, hidden: true, label: null };
      }
      return { ...data, color: dimEdgeOf(data.color), label: null };
    },
  });

  sigma.setCustomBBox(frame);

  const camera = sigma.getCamera();
  // Departure: two guards read the stored camera. The workspace drops a record it does not
  // know, and `restorableCamera` drops a ratio outside the bounds of this canvas.
  const storedCamera = restorableCamera(stored.camera);
  if (storedCamera !== null) {
    camera.setState({ x: storedCamera.x, y: storedCamera.y, ratio: storedCamera.ratio });
  }

  const layer = document.createElement('div');
  layer.className = LAYER_CLASS;
  const ring = document.createElement('div');
  ring.className = RING_CLASS;
  ring.hidden = true;
  layer.append(ring);

  const hoverLabel = document.createElement('div');
  hoverLabel.className = CARD_CLASS;
  hoverLabel.hidden = true;
  layer.append(hoverLabel);
  overlay.append(layer);

  const markers: HTMLDivElement[] = [];

  const names: HTMLDivElement[] = [];

  function sizeLabelPool(pool: HTMLDivElement[], count: number, className: string): void {
    while (pool.length < count) {
      const element = document.createElement('div');
      element.className = className;
      element.hidden = true;
      layer.append(element);
      pool.push(element);
    }
    while (pool.length > count) {
      pool.pop()?.remove();
    }
  }

  function sizeMarkerPool(count: number): void {
    while (markers.length < count) {
      const element = document.createElement('div');
      element.className = MARKER_CLASS;
      element.hidden = true;
      layer.append(element);
      markers.push(element);
    }
    while (markers.length > count) {
      markers.pop()?.remove();
    }
  }

  // `getNodeDisplayData` answers in the framed coordinate system. Its answer is paired with
  // `framedGraphToViewport` below, and never with `graphToViewport`. The wrong pair puts every
  // overlay element near the middle of the canvas, and it looks correct for a node near the origin.
  const framedPointOf = (id: string): Coordinates | null => {
    const node = sigma.getNodeDisplayData(id);
    if (node !== undefined) return { x: node.x, y: node.y };
    if (!model.graph.hasEdge(id)) return null;
    const source = sigma.getNodeDisplayData(model.graph.source(id));
    const target = sigma.getNodeDisplayData(model.graph.target(id));
    if (source === undefined || target === undefined) return null;
    // The middle of two framed points is a framed point, because the frame is linear.
    return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 };
  };

  /** `size` is the diameter in pixels, or `null` where the element carries its own size. */
  const outsideOf = (point: Coordinates): boolean => {
    const { width, height } = sigma.getDimensions();
    return (
      point.x < -OVERLAY_MARGIN ||
      point.y < -OVERLAY_MARGIN ||
      point.x > width + OVERLAY_MARGIN ||
      point.y > height + OVERLAY_MARGIN
    );
  };

  const viewportOf = (id: string): Coordinates | null => {
    const point = framedPointOf(id);
    return point === null ? null : sigma.framedGraphToViewport(point);
  };

  const place = (element: HTMLElement, point: Coordinates, size: number | null): void => {
    const outside = outsideOf(point);
    element.hidden = outside;
    if (outside) return;
    if (size !== null) {
      element.style.width = `${size}px`;
      element.style.height = `${size}px`;
    }
    element.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
  };

  // A name stands above its node. The names of the first ring can meet; the hover label still
  // names each node one at a time.
  const drawNames = (): void => {
    shownNames.forEach((id, index) => {
      const element = names[index];
      if (element === undefined) return;
      const spot = viewportOf(id);
      if (spot === null || outsideOf(spot)) {
        element.hidden = true;
        return;
      }
      element.hidden = false;
      const radius = sigma.scaleSize(sigma.getNodeDisplayData(id)?.size ?? 0) + NAME_OFFSET;
      element.style.transform = `translate(${spot.x}px, ${spot.y - radius}px) translate(-50%, -100%)`;
    });
  };

  const drawOverlay = (): void => {
    if (destroyed) return;
    drawNames();

    const selected = selection;
    const litSelection =
      selected !== null &&
      (selected.kind === 'entity' ? litNodes.has(selected.id) : litEdges.has(selected.id));
    if (selected === null || !litSelection) {
      ring.hidden = true;
    } else {
      const point = framedPointOf(selected.id);
      if (point === null) ring.hidden = true;
      else {
        const data = selected.kind === 'entity' ? sigma.getNodeDisplayData(selected.id) : undefined;
        const diameter =
          data === undefined ? RING_ON_RELATION : 2 * sigma.scaleSize(data.size) + RING_MARGIN;
        place(ring, sigma.framedGraphToViewport(point), diameter);
      }
    }

    // The label follows the thing it names, and not the pointer: the camera may move while the
    // pointer stands still, and a label left at the old pixel would name empty ground.
    if (hovered === null) hoverLabel.hidden = true;
    else {
      const point = framedPointOf(hovered.id);
      if (point === null) hoverLabel.hidden = true;
      else {
        const { x, y } = sigma.framedGraphToViewport(point);
        const { width, height } = sigma.getDimensions();
        hoverLabel.hidden =
          x < -OVERLAY_MARGIN ||
          y < -OVERLAY_MARGIN ||
          x > width + OVERLAY_MARGIN ||
          y > height + OVERLAY_MARGIN;
        // The card is 280px wide and stays inside the canvas, or its values are cut off.
        const half = cardHalfWidth;
        const inside = Math.min(Math.max(x, half + 8), Math.max(width - half - 8, half + 8));
        hoverLabel.style.transform = canvasLabelTransform(inside, y);
      }
    }

    markerTargets.forEach((target, index) => {
      const element = markers[index];
      if (element === undefined) return;
      const point = framedPointOf(target);
      if (point === null) {
        element.hidden = true;
        return;
      }
      // The badge stands clear of the dot, at its upper right.
      const at = sigma.framedGraphToViewport(point);
      place(element, { x: at.x + MARKER_OFFSET, y: at.y - MARKER_OFFSET }, null);
    });
  };

  const framedOf = (point: NodePosition): Coordinates => ({
    x: (point.x - frameX) / frameSpan + 0.5,
    y: (point.y - frameY) / frameSpan + 0.5,
  });

  const aspectNow = (): number => {
    const { width, height } = sigma.getDimensions();
    return width > 0 && height > 0 ? Math.min(Math.max(width / height, 1), MAX_ASPECT) : MAX_ASPECT;
  };

  const moveCamera = (target: { x: number; y: number; ratio: number }): void => {
    // A reader who asks for no motion gets a jump. The preference is read at each call.
    if (motionOf() === 0) camera.setState(target);
    else void camera.animate(target, { duration: motionOf() });
  };

  /** How many pixels of the foot of the canvas a sheet covers. */
  let bottomInset = 0;

  /** Fits the camera to the nodes, and never nearer than the bound of the camera. */
  const fitCamera = (ids: Iterable<string>, nearest = NEAREST_RATIO): void => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const id of ids) {
      if (!model.graph.hasNode(id)) continue;
      const { x, y } = framedOf(model.graph.getNodeAttributes(id));
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    if (minX > maxX) return;
    // At a ratio of 1 the stored picture fills the shorter side of the canvas, so the longer side
    // shows the ratio times the aspect.
    const { width, height } = sigma.getDimensions();
    // On a tall canvas the shorter side is the width, so the height shows more than one ratio.
    const tall = width > 0 ? Math.max(1, height / width) : 1;
    // A sheet over the foot of the canvas hides this share of it. The nodes are fitted into the
    // part above the sheet, and the camera centre moves down by half of the hidden share.
    const visible = height > 0 ? Math.max(0.25, (height - bottomInset) / height) : 1;
    const needed =
      Math.max((maxY - minY) / (visible * tall), (maxX - minX) / aspectNow()) * FIT_MARGIN;
    const ratio = Math.min(FARTHEST_RATIO, Math.max(nearest, needed));
    const hidden = (1 - visible) * ratio * tall;
    moveCamera({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 - hidden / 2, ratio });
  };

  // Each value that did not change keeps its identity, so a consumer that memoises on `filter` or
  // on `selection` is not woken by a publish that only folded a panel. `graph-page.tsx` derives
  // every row of the rail from the filter.
  const viewOf = (): GraphView => ({
    selection,
    filter,
    relationFilter,
    lit,
    dimmed,
    counts,
    markersDrawn: markerTargets.length,
    markersOverCap,
    openUnits: folds.open,
    unplaced: placement.unplaced.size,
    variant: variant.id,
    showUnplaced,
    railOpen,
    railWidth,
  });

  // The canvases of the library carry no text. The element that holds them is one image with a
  // name, and the text view beside the island says the same in a list.
  canvas.setAttribute('role', 'img');
  const nameCanvas = (): void => {
    const rules = { hiddenTypes: hidden, showUnplaced, hiddenRelationTypes: hiddenRelations };
    canvas.setAttribute(
      'aria-label',
      describeDrawing(counts, deriveTextView(model.graph, selection, rules, wordsOf)),
    );
  };

  const publish = (): void => {
    nameCanvas();
    const view = viewOf();
    // The set is copied, because a listener may unsubscribe inside its own call.
    for (const listener of [...listeners]) listener(view);
  };

  const announce = (): void => {
    for (const listener of [...selectListeners]) listener(selection);
  };

  // Departure: it moves no camera. The callers that must move it do so after the call.
  const settle = (next: GraphSelection | null): void => {
    const changed = !sameSelection(next, selection);
    selection = next;
    if (changed) {
      writeSelectionAddress(selection);
      announce();
    }
    recount();
    sigma.refresh();
    publish();
  };

  // Departure: a selection that a closed unit folds opens the path down to it, so the rail list
  // shows its row. The canvas draws it either way.
  const reveal = (candidate: GraphSelection | null): void => {
    if (candidate === null) return;
    const graph = model.graph;
    const ends: string[] = [];
    if (candidate.kind === 'entity') ends.push(candidate.id);
    else if (graph.hasEdge(candidate.id)) {
      ends.push(graph.source(candidate.id), graph.target(candidate.id));
    }
    for (const end of ends) {
      if (graph.hasNode(end) && passesFilter(graph.getNodeAttributes(end))) folds.reveal(end);
    }
  };

  // The address is read one time. A selection that names no drawn element, or one that the stored
  // filter excludes, is dropped here. One that a unit folds is revealed first.
  const restored = readSelectionAddress();
  reveal(restored);
  selection = acceptable(restored);
  if (!sameSelection(restored, selection)) {
    // The address named an element that this graph does not mark. The address is corrected, so
    // that the picture and the address never state two different things.
    writeSelectionAddress(selection);
  }
  // The restore does not go through `settle`, so nothing announces it here. `onSelect` seeds
  // every listener with the selection of the moment, and no subscriber can arrive too late.
  recount();
  nameCanvas();
  // An entity in the address takes the place of the stored camera. The fit waits for the first
  // size of the canvas, because the shape of the canvas sets the fit.
  let fitAtFirstSize = selection?.kind === 'entity';

  // The first render occurs inside the constructor of Sigma, so this listener never hears that
  // first frame. One refresh, after the listener exists, puts the ring and each marker up.
  sigma.on('afterRender', drawOverlay);
  sigma.refresh();

  // The shown nodes and relations pull the layout. A switch of a type or a family starts a new
  // run from the places the nodes hold, so they move to the new place and do not jump.
  const raw = new Map(positions);
  // A move takes this long. It is a little under the time between two answers of the worker.
  const MOVE_MS = 400;
  let moveStart = 0;
  let moveFrame = 0;
  const stepMove = (now: number): void => {
    const share = Math.max(0, Math.min(1, (now - moveStart) / MOVE_MS));
    // Ease out: the nodes are fast at the start and settle at the end.
    morph.progress = 1 - (1 - share) ** 3;
    sigma.scheduleRender();
    moveFrame = share < 1 ? requestAnimationFrame(stepMove) : 0;
  };
  const layoutWorker = new Worker(new URL('./layout-worker.ts', import.meta.url), {
    type: 'module',
  });
  const liveLayout = createLiveLayout(
    raw,
    { cx: frameX, cy: frameY, span: frameSpan },
    (places) => {
      // Each node that moves starts from the place where it is drawn now, which can be on the way
      // of an earlier move. The card does the move, so a frame of it is as cheap as a pan.
      const next = new Map<string, { fromX: number; fromY: number }>();
      for (const node of places.keys()) {
        const now = sigma.getNodeDisplayData(node);
        if (now === undefined) continue;
        const from = moves.get(node);
        next.set(node, {
          fromX: from === undefined ? now.x : from.fromX + (now.x - from.fromX) * morph.progress,
          fromY: from === undefined ? now.y : from.fromY + (now.y - from.fromY) * morph.progress,
        });
      }
      moves.clear();
      for (const [node, from] of next) moves.set(node, from);
      // One event for all the nodes: an event for each node would wake Sigma 6000 times. The
      // event schedules the draw, so no refresh follows: a second one would run the work twice.
      model.graph.updateEachNodeAttributes((node, attrs) => {
        const at = places.get(node);
        return at === undefined ? attrs : Object.assign(attrs, at);
      });
      morph.progress = 0;
      moveStart = performance.now();
      if (moveFrame === 0) moveFrame = requestAnimationFrame(stepMove);
    },
    layoutWorker,
  );
  const sectorOf = (index: number, count: number, node: string): { x: number; y: number } => {
    // A fixed spread inside the sector of the type, from the characters of the identifier.
    let hash = 7;
    for (let at = 0; at < node.length; at += 1)
      hash = (hash * 31 + node.charCodeAt(at)) % 1_000_003;
    const along = (hash % 1000) / 1000;
    const out = ((hash >> 3) % 1000) / 1000;
    const angle = ((index + 0.1 + 0.8 * along) / Math.max(count, 1)) * 2 * Math.PI;
    const radius = 0.3 + 0.7 * Math.sqrt(out);
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  };
  const reseedByType = (): void => {
    const kinds = [...new Set(model.graph.mapNodes((_node, a) => a.entityType))].sort();
    model.graph.forEachNode((node, attrs) => {
      raw.set(node, sectorOf(kinds.indexOf(attrs.entityType), kinds.length, node));
    });
  };
  const relayout = (): void => {
    const input = layoutInput(
      model.graph,
      (node) => passesFilter(model.graph.getNodeAttributes(node)),
      hiddenRelations,
      variant.weights,
    );
    // The size of a node is its share of the strongest node in view, so a variant reads weight.
    let strongest = 0;
    for (const value of input.strength.values()) strongest = Math.max(strongest, value);
    // A crowd shrinks every node, so 5000 nodes do not cover one another.
    // 1500 nodes is the count where the largest glyph still leaves room for its neighbours.
    const crowd = Math.min(1, Math.sqrt(1500 / Math.max(1, input.nodes.length)));
    const sized = (share: number): number => Math.max(3, variant.sizeOf(share) * crowd);
    const sizes = new Map<string, number>();
    for (const node of input.nodes) {
      const share = strongest === 0 ? 0 : (input.strength.get(node) ?? 0) / strongest;
      sizes.set(node, sized(share));
    }
    for (const node of input.rest) sizes.set(node, sized(0));
    model.graph.updateEachNodeAttributes((node, attrs) => {
      const size = sizes.get(node);
      return size === undefined ? attrs : Object.assign(attrs, { size });
    });
    liveLayout.run(input, variant.forces);
  };
  relayout();

  // Sigma registers no observer of its own: it measures the container in the constructor and
  // never again. A canvas of the wrong size draws correctly and warns about nothing. The sizes
  // are whole numbers, and the seed is a value no delivery reports, so the first one resizes.
  let usedWidth = NO_SIZE;
  let usedHeight = NO_SIZE;
  const sizeObserver = new ResizeObserver((entries) => {
    if (destroyed) return;
    for (const entry of entries) {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width === usedWidth && height === usedHeight) continue;
      usedWidth = width;
      usedHeight = height;
      // `resize` sets the width and the height of each canvas, which empties it, and it
      // schedules no frame. Without the refresh the graph stays blank until the next event of
      // the pointer, and the panel that opens on a selection is what changes this width.
      sigma.resize();
      if (fitAtFirstSize) {
        fitAtFirstSize = false;
        fitCamera(nearOf(), SELECT_RATIO);
      }
      sigma.refresh();
    }
  });
  sizeObserver.observe(canvas);

  // Every writer patches the workspace and never replaces it: two writers with two partial
  // records each erase the other's field.
  let cameraTimer: number | null = null;
  const storeCamera = (): void => {
    const state = camera.getState();
    patchGraphWorkspace({ camera: { x: state.x, y: state.y, ratio: state.ratio } });
  };
  const onCameraUpdated = (): void => {
    if (destroyed) return;
    if (cameraTimer !== null) window.clearTimeout(cameraTimer);
    cameraTimer = window.setTimeout(() => {
      cameraTimer = null;
      if (!destroyed) storeCamera();
    }, CAMERA_STORE_WAIT);
  };
  camera.on('updated', onCameraUpdated);

  // The selection and the camera move together: the reader sees the entity and its first ring.
  const selectEntity = (id: string): void => {
    if (destroyed || !nodeConsidered(id)) return;
    const next: GraphSelection = { kind: 'entity', id };
    reveal(next);
    settle(next);
    fitCamera(nearOf(), SELECT_RATIO);
  };

  // The picking layer of Sigma answers with a dimmed node as well, so the guard is in the call.
  sigma.on('clickNode', ({ node }) => {
    selectEntity(node);
  });

  sigma.on('clickEdge', ({ edge }) => {
    if (destroyed || !edgeConsidered(edge)) return;
    const next: GraphSelection = { kind: 'relation', id: edge };
    reveal(next);
    settle(next);
  });

  // A click on the ground clears the selection. The library emits this event only where it found
  // no node and no edge under the pointer.
  sigma.on('clickStage', () => {
    if (destroyed) return;
    settle(null);
  });

  // The card opens after 120ms of hover and closes at once. A click opens the detail panel.
  let cardTimer: number | null = null;
  const stopCardTimer = (): void => {
    if (cardTimer !== null) window.clearTimeout(cardTimer);
    cardTimer = null;
  };

  const fillCard = (card: HoverCard): void => {
    const eyebrow = document.createElement('div');
    eyebrow.className = 'flex items-center gap-1.5 text-caption tracking-caps text-label uppercase';
    if (card.type !== null) {
      eyebrow.append(glyphSvg(card.type, model.hueOfType.get(card.type) ?? 'currentColor'));
    }
    const eyebrowText = document.createElement('span');
    eyebrowText.className = 'truncate';
    eyebrowText.textContent = card.eyebrow;
    eyebrow.append(eyebrowText);
    const name = document.createElement('div');
    name.className = 'truncate text-body-sm';
    name.textContent = card.name;
    const rows = card.rows.map(([key, value]) => {
      const row = document.createElement('div');
      row.className = 'flex justify-between gap-2 text-data';
      const keyElement = document.createElement('span');
      keyElement.className = 'text-muted-foreground';
      keyElement.textContent = key;
      const valueElement = document.createElement('span');
      valueElement.className = 'truncate font-mono';
      valueElement.textContent = value;
      row.append(keyElement, valueElement);
      return row;
    });
    hoverLabel.replaceChildren(eyebrow, name, ...rows);
  };

  const nameHover = (next: HoverCard | null): void => {
    if (destroyed) return;
    stopCardTimer();
    hovered = null;
    hoverLabel.hidden = true;
    if (next === null) return;
    cardTimer = window.setTimeout(() => {
      cardTimer = null;
      if (destroyed) return;
      fillCard(next);
      hoverLabel.hidden = false;
      cardHalfWidth = hoverLabel.offsetWidth / 2;
      hovered = next;
      // The card is placed on the next frame, with the ring and the markers, so one loop owns
      // every element over this canvas.
      sigma.refresh();
    }, CARD_DELAY_MS);
  };

  // The count of relations states what the size alone cannot: a reader cannot compare two discs.
  const nodeCard = (node: string): HoverCard => {
    const attrs = model.graph.getNodeAttributes(node);
    const subordinates = hierarchy.subordinatesOf(node).length;
    return {
      id: node,
      type: attrs.type,
      eyebrow: model.labelOfType(attrs.entityType),
      name: attrs.label,
      rows: [
        ['Relations', String(attrs.degree)],
        ...(subordinates === 0 ? [] : [['Subordinates', String(subordinates)] as const]),
      ],
    };
  };

  sigma.on('enterNode', ({ node }) => {
    if (!nodeConsidered(node)) return;
    nameHover(nodeCard(node));
  });
  sigma.on('leaveNode', ({ node }) => {
    if (hovered?.id === node || cardTimer !== null) nameHover(null);
  });

  // A relation has no name of its own, so it is named by its type and its two ends.
  sigma.on('enterEdge', ({ edge }) => {
    if (!edgeConsidered(edge)) return;
    const from = model.graph.getNodeAttribute(model.graph.source(edge), 'label');
    const to = model.graph.getNodeAttribute(model.graph.target(edge), 'label');
    const type = model.graph.getEdgeAttribute(edge, 'relationType');
    const family = model.graph.getEdgeAttribute(edge, 'type');
    nameHover({
      id: edge,
      type: null,
      eyebrow: wordsOf(type).label,
      name: `${from} → ${to}`,
      rows: [['Family', lookOf(family).label]],
    });
  });
  sigma.on('leaveEdge', ({ edge }) => {
    if (hovered?.id === edge || cardTimer !== null) nameHover(null);
  });

  // Each member does nothing after `destroy`: a call into a killed Sigma throws, and a write to
  // the workspace from a dead adapter keeps that value for each later open.
  const stopTheme = observeCanvasTheme((next) => {
    ground = next;
    dimCache.clear();
    dimEdgeCache.clear();
    groundColour = groundHue(next);
    setGround(groundColour);
    model.setGround(next);
    sigma.refresh();
    publish();
  });

  const controller: GraphController = {
    get model() {
      return model;
    },
    select: selectEntity,
    openRelation: (id) => {
      if (destroyed || !edgeConsidered(id)) return;
      const next: GraphSelection = { kind: 'relation', id };
      reveal(next);
      settle(next);
    },
    setUnitOpen: (unit, open) => {
      if (destroyed || !nodeConsidered(unit) || !folds.setOpen(unit, open)) return;
      // Departure: a fold changes the rail list alone, so it repaints no canvas.
      publish();
    },
    setFilter: (patch) => {
      if (destroyed) return;
      const next: FilterState = { ...filter, ...patch };
      // **A filter that nobody changed keeps its object**, so a consumer that memoises on it is
      // not woken and the store takes no write. A new object for an equal set would derive every
      // row of the rail again for a switch that moved nothing.
      if (!sameTypes(next.hiddenTypes, filter.hiddenTypes)) {
        filter = { hiddenTypes: [...next.hiddenTypes] };
        hidden = new Set(filter.hiddenTypes);
        patchGraphWorkspace({ hiddenTypes: filter.hiddenTypes });
        relayout();
      }
      // **A filter that excludes the selection drops the selection.**
      settle(acceptable(selection));
    },
    setRelationFilter: (patch) => {
      if (destroyed) return;
      const next: RelationFilterState = { ...relationFilter, ...patch };
      if (sameTypes(next.hiddenRelationTypes, relationFilter.hiddenRelationTypes)) return;
      relationFilter = { hiddenRelationTypes: [...next.hiddenRelationTypes] };
      hiddenRelations = new Set(relationFilter.hiddenRelationTypes);
      patchGraphWorkspace({ hiddenRelationTypes: relationFilter.hiddenRelationTypes });
      relayout();
      // A selected relation of a type that is now off is dropped, as the filter drops a node.
      settle(acceptable(selection));
    },
    setVariant: (id) => {
      if (destroyed || id === variant.id) return;
      variant = variantOf(id);
      if (variant.seedByType) reseedByType();
      relayout();
      publish();
    },
    setShowUnplaced: (show) => {
      if (destroyed || show === showUnplaced) return;
      showUnplaced = show;
      patchGraphWorkspace({ showUnplaced });
      relayout();
      settle(acceptable(selection));
    },
    setRailOpen: (open) => {
      if (destroyed) return;
      railOpen = open;
      // Every writer patches, and never replaces. A panel key is the workspace, and this file is
      // the one store of it: `graph-page.tsx` held a React copy beside it, and a value in two
      // stores is a fault.
      patchGraphWorkspace({ railOpen: open });
      publish();
    },
    setRailWidth: (width) => {
      if (destroyed || width === railWidth) return;
      railWidth = width;
      patchGraphWorkspace({ railWidth: width });
      publish();
    },
    clearSelection: () => {
      if (destroyed) return;
      settle(null);
    },
    setBottomInset: (pixels) => {
      if (destroyed || pixels === bottomInset) return;
      bottomInset = pixels;
      if (selection?.kind === 'entity') fitCamera(nearOf(), SELECT_RATIO);
    },
    zoom: (direction) => {
      if (destroyed) return;
      const state = camera.getState();
      const ratio = state.ratio * (direction === 'in' ? 0.5 : 2);
      moveCamera({
        x: state.x,
        y: state.y,
        ratio: Math.min(FARTHEST_RATIO, Math.max(NEAREST_RATIO, ratio)),
      });
    },
    subscribe: (listener) => {
      if (destroyed) return NO_OP;
      listeners.add(listener);
      // A component that subscribes after the canvas is built has already missed the restore of
      // the address. So the listener is called here with the view of this moment.
      listener(viewOf());
      return () => listeners.delete(listener);
    },
    onSelect: (listener) => {
      if (destroyed) return NO_OP;
      selectListeners.add(listener);
      // A component that subscribes after the canvas is built has already missed the restore of
      // the address. So the listener is called here with the selection of this moment.
      listener(selection);
      return () => selectListeners.delete(listener);
    },
    destroy: () => {
      liveLayout.destroy();
      cancelAnimationFrame(moveFrame);
      morph.progress = 1;
      layoutWorker.terminate();
      if (destroyed) return;
      // A camera that waits for the trailing store is the camera of the analyst. It is written
      // before the instance dies, and never after it.
      if (cameraTimer !== null) {
        window.clearTimeout(cameraTimer);
        cameraTimer = null;
        storeCamera();
      }
      destroyed = true;
      stopCardTimer();
      sizeObserver.disconnect();
      stopTheme();
      camera.off('updated', onCameraUpdated);
      sigma.off('afterRender', drawOverlay);
      listeners.clear();
      selectListeners.clear();
      markers.length = 0;
      names.length = 0;
      // The layer is the one node this file added to the element of the caller.
      layer.remove();
      canvas.removeAttribute('role');
      canvas.removeAttribute('aria-label');
      if (mounted.get(canvas) === controller) mounted.delete(canvas);
      sigma.kill();
    },
  };

  mounted.set(canvas, controller);
  return controller;
}
