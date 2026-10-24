import { canvasTheme, observeCanvasTheme } from '@/shared/canvas-theme';
import Sigma from 'sigma';
import type { Coordinates, EdgeDisplayData, NodeDisplayData } from 'sigma/types';

import {
  CANVAS_LABEL_CLASS,
  canvasLabelTransform,
  entityLines,
  relationLines,
} from '@/shared/canvas-label';
import type { Corpus, EntityPosition, TypeVocabulary } from '@/shared/read/model';
import { relationWording } from '@/shared/relation-words';
import { foldEveryUnit } from '@/shared/unit-folds';

import { createDashedArrowProgram } from './dashed-edge-program';
import { FARTHEST_RATIO, NEAREST_RATIO, restorableCamera } from './camera-bounds';
import { layoutFocus } from './focus';
import { edgeLabelPlace, spreadDown } from './focus-labels';
import {
  buildGraphModel,
  dimmedColour,
  GROUND_HUE,
  type EdgeAttrs,
  type GraphGround,
  type GraphModel,
  type NodeAttrs,
  type NodePosition,
} from './model';
import { graphPositions } from './positions';
import { FAMILIES } from './relation-families';
import { type RelationFilterState } from './relation-filter';
import { readSelectionAddress, writeSelectionAddress, type GraphSelection } from './selection';
import { countShown, type ShownCounts } from './shown-counts';
import { describeDrawing, deriveTextView } from './text-view';
import { isShown, type FilterState } from './type-filter';
import { patchGraphWorkspace, readGraphWorkspace } from './workspace';

/** What the canvas draws. `focus` draws one entity and its neighbours, and `whole` draws every entity. */
export type GraphMode = 'focus' | 'whole';

export interface GraphView {
  readonly mode: GraphMode;
  readonly hops: 1 | 2;
  /** The entities the focus draws, and how many of those the canvas leaves without a name. */
  readonly focusDrawn: number;
  readonly focusUnnamed: number;
  readonly focusUnnamedRelations: number;
  /** The neighbours of the selected entity that the focus does not draw yet. */
  readonly expandable: number;
  readonly selection: GraphSelection | null;
  readonly filter: FilterState;
  /** The relation types that the legend switches off. */
  readonly relationFilter: RelationFilterState;
  readonly lit: number;
  readonly dimmed: number;
  /** What the drawing shows against what the record holds: the nodes the filter keeps, and in a
   * focus only those the focus draws. */
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
  readonly railOpen: boolean;
  readonly railWidth: number;
}

export interface GraphController {
  readonly model: GraphModel;
  /** Draws the entity and its neighbours alone, and moves the camera to them. */
  readonly focusOn: (id: string) => void;
  /** How far the focus reaches from its centre. It draws the focus again from the centre. */
  readonly setHops: (hops: 1 | 2) => void;
  /** Selects a relation, as a click on it does. The picture and the focus stay as they are. */
  readonly openRelation: (id: string) => void;
  /** Adds the neighbours of the selected entity to the focus. */
  readonly expand: () => void;
  readonly setUnitOpen: (unit: string, open: boolean) => void;
  readonly setFilter: (patch: Partial<FilterState>) => void;
  /** Hides or draws the relations of the types the patch names. */
  readonly setRelationFilter: (patch: Partial<RelationFilterState>) => void;
  /** Draws or hides the entities that stand on the ring with no place. */
  readonly setShowUnplaced: (show: boolean) => void;
  /** The rail was unfolded or folded. The workspace keeps it, so the next open finds it there. */
  readonly setRailOpen: (open: boolean) => void;
  /** The rail edge was dragged. The workspace keeps the width, as it keeps the fold. */
  readonly setRailWidth: (width: number) => void;
  /** Ends the selection, as a click on the ground does. The focus and the camera stay. */
  readonly clearSelection: () => void;
  /** Back to every entity: the focus ends, and the camera frames the whole picture. */
  readonly showWholeGraph: () => void;
  readonly subscribe: (listener: (view: GraphView) => void) => () => void;
  /** The selection alone. A fold of the rail publishes a view and calls no listener of this. */
  readonly onSelect: (listener: (selection: GraphSelection | null) => void) => () => void;
  readonly destroy: () => void;
}

// 1000 is the cap on markers. A marker is a page element placed over its element on every frame,
// so the cost is linear and it runs in the render loop. Measured at ten thousand entities: 1500
// holds 60 Hz, 2000 misses every frame, and 4000 runs at 19 fps. This is half of the wall.
const MARKER_CAP = 1000;

/**
 * How far a selection lights the graph around itself. Two hops.
 */
const HOPS = 2;

// The first ring of a focus has this radius, in parts of the span of the stored picture. Origin:
// invented. The camera fits the focus to the canvas, so this sets only how large a disc draws.
const FOCUS_RING = 0.1;

// The camera leaves this much room around the nodes it fits, as a factor of their extent.
const FIT_MARGIN = 1.6;

// A click on a node fits the node and its neighbours, and never closer than this part of the fit
// of the whole focus, so a leaf does not fill the canvas with one disc.
const NEAREST_FIT = 0.8;

// The camera counts the canvas as at most this much wider than it is high, so the names at the two
// sides of a focus keep room. Origin: invented; the island is 32 rem high and about 44 rem wide.
const MAX_ASPECT = 1.7;

// A name and a relation are page elements, as the markers are, and the cost is the same: linear,
// in the render loop. Origin: invented, at a tenth of the marker cap. A focus that holds more
// elements names the most connected and says in words how many it leaves out.
const NAME_CAP = 40;

// The space between two names on one side of the focus, in pixels. A name is one line of text.
const NAME_GAP = 16;

// The space between a node and its name, beside the radius of the node, in pixels.
const NAME_OFFSET = 4;

const NAME_CLASS =
  'pointer-events-none absolute top-0 left-0 max-w-48 truncate bg-background px-1 text-xs text-foreground';

const RELATION_CLASS =
  'pointer-events-none absolute top-0 left-0 max-w-32 truncate text-xs text-muted-foreground';

// The dim keeps this much of the colour. It is measured against the two theme grounds: a
// dimmed element reads at about 1.9:1 on light and 2.3:1 on dark, against
// 4.9:1 and 6.7:1 while lit. One value of 0.2 for both grounds made the light theme read empty.
const DIM_ALPHA: Readonly<Record<GraphGround, number>> = { light: 0.45, dark: 0.4 };

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

// A fixed offset, and not a fraction of the radius: a hub of two thousand relations would push
// its badge far out into the picture, and a leaf would keep the badge on top of itself.
const MARKER_OFFSET = 7;

// The ring is never drawn with the `highlighted` flag of Sigma: that flag makes the library draw
// its own hover card, in colours that no token of this repository reaches.
const RING_CLASS =
  'pointer-events-none absolute top-0 left-0 rounded-full border-2 border-foreground';

/** How much larger the ring is than the node it names, in pixels of diameter. */
const RING_MARGIN = 6;

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
  let hops = stored.hops;
  let showUnplaced = stored.showUnplaced;

  // The canvas opens on the whole picture, so the reader meets a drawn graph at once.
  let mode: GraphMode = 'whole';
  let focusCentre: string | null = null;
  let expanded: string[] = [];
  let drawnNodes: ReadonlySet<string> = new Set();
  let hopsOf: ReadonlyMap<string, number> = new Map();
  let usedAspect = MAX_ASPECT;

  // The stored picture is the frame. Sigma normalises on the extent of the nodes it holds, and a
  // focus moves nodes, so the frame is fixed here. A node that stands out of the frame is hidden.
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
  let lit = 0;
  let dimmed = 0;
  let counts: ShownCounts = countShown(model.graph, new Set(), hiddenRelations);

  /** The elements that carry a marker on this frame, and how many get none. */
  let markerTargets: readonly string[] = [];
  let markersOverCap = 0;

  // The hover is not on the view and it never publishes: a hover changes as fast as the pointer
  // moves, and a publish on each one would run every subscriber of this handle at that rate.
  let hovered: { readonly id: string; readonly lines: readonly string[] } | null = null;

  // A reducer runs for each element on each frame, so a dimmed colour is computed one time.
  const dimCache = new Map<string, string>();
  const dimOf = (colour: string): string => {
    const held = dimCache.get(colour);
    if (held !== undefined) return held;
    const made = dimmedColour(colour, GROUND_HUE[ground], DIM_ALPHA[ground]);
    dimCache.set(colour, made);
    return made;
  };

  // The test is on the dim of the filter, and not on the dim of a selection. The two hops of a
  // selection dim as well, and they must not stop a click on a node on the other side.
  const passesFilter = (attrs: NodeAttrs): boolean => isShown(attrs, hidden, showUnplaced);

  const nodeConsidered = (node: string): boolean =>
    model.graph.hasNode(node) && passesFilter(model.graph.getNodeAttributes(node));

  /** A relation of a type that the legend switches off is not drawn, and it joins nothing. */
  const typeShown = (edge: string): boolean =>
    !hiddenRelations.has(model.graph.getEdgeAttribute(edge, 'relationType'));

  /** The other end of each relation of the node that is drawn. A relation of a type that is
   * switched off leads nowhere, so a focus and a walk never reach a neighbour through it. */
  const forEachLinked = (node: string, visit: (neighbour: string) => void): void => {
    model.graph.forEachEdge(node, (edge, _attrs, source, target) => {
      if (typeShown(edge)) visit(source === node ? target : source);
    });
  };

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

  // The walk steps through the nodes that pass the filter only: out of consideration is out of
  // reach, so an excluded node carries no neighbourhood.
  const reachOf = (passes: ReadonlySet<string>): ReadonlySet<string> | null => {
    if (selection === null) return null;
    const seeds: string[] = [];
    if (selection.kind === 'entity') {
      if (model.graph.hasNode(selection.id)) seeds.push(selection.id);
    } else if (model.graph.hasEdge(selection.id)) {
      // A relation is selected, so both of the elements it joins are in focus.
      seeds.push(model.graph.source(selection.id), model.graph.target(selection.id));
    }
    if (seeds.length === 0) return null;

    const reach = new Set(seeds);
    let frontier: readonly string[] = seeds;
    for (let hop = 0; hop < HOPS; hop += 1) {
      const next: string[] = [];
      for (const node of frontier) {
        forEachLinked(node, (neighbour) => {
          if (!passes.has(neighbour) || reach.has(neighbour)) return;
          reach.add(neighbour);
          next.push(neighbour);
        });
      }
      frontier = next;
    }
    return reach;
  };

  // The neighbours a focus may draw: the nodes that pass the filter, each once, grouped by type
  // and then by name, so that the same kind of thing stands side by side on the ring.
  const orderKey = (node: string): string =>
    `${model.graph.getNodeAttribute(node, 'entityType')}\u0000${model.graph.getNodeAttribute(node, 'label')}\u0000${node}`;

  const neighboursOf = (node: string): readonly string[] => {
    if (!model.graph.hasNode(node)) return [];
    const found = new Set<string>();
    forEachLinked(node, (neighbour) => {
      if (neighbour !== node && passesFilter(model.graph.getNodeAttributes(neighbour))) {
        found.add(neighbour);
      }
    });
    return [...found].sort((one, two) => orderKey(one).localeCompare(orderKey(two)));
  };

  /** The names and the relation words that the focus draws, and the count it leaves without. */
  let focusNames: readonly string[] = [];
  let focusRelations: readonly string[] = [];
  let focusUnnamed = 0;
  let focusUnnamedRelations = 0;
  let parallels: ReadonlyMap<string, { readonly index: number; readonly count: number }> =
    new Map();

  function nameFocus(): void {
    if (mode !== 'focus') {
      focusNames = [];
      focusRelations = [];
      focusUnnamed = 0;
      focusUnnamedRelations = 0;
      parallels = new Map();
      sizeLabelPool(names, 0, NAME_CLASS);
      sizeLabelPool(relationLabels, 0, RELATION_CLASS);
      return;
    }

    const selectedId = selection?.kind === 'entity' ? selection.id : null;
    const rank = (node: string): number =>
      node === focusCentre ? 0 : node === selectedId ? 1 : (hopsOf.get(node) ?? 3) + 1;
    const ranked = [...litNodes].sort(
      (one, two) =>
        rank(one) - rank(two) ||
        model.graph.getNodeAttribute(two, 'degree') - model.graph.getNodeAttribute(one, 'degree') ||
        one.localeCompare(two),
    );
    focusNames = ranked.slice(0, NAME_CAP);
    focusUnnamed = ranked.length - focusNames.length;

    // Relations between the same two nodes share a key, whatever their direction.
    const groups = new Map<string, string[]>();
    for (const edge of [...litEdges].sort()) {
      const ends = [model.graph.source(edge), model.graph.target(edge)].sort();
      const key = `${ends[0] ?? ''}\u0000${ends[1] ?? ''}`;
      const held = groups.get(key);
      if (held === undefined) groups.set(key, [edge]);
      else held.push(edge);
    }
    const slots = new Map<string, { readonly index: number; readonly count: number }>();
    for (const group of groups.values()) {
      group.forEach((edge, index) => slots.set(edge, { index, count: group.length }));
    }
    parallels = slots;

    const touches = (edge: string): number =>
      model.graph.source(edge) === focusCentre || model.graph.target(edge) === focusCentre ? 0 : 1;
    const edges = [...litEdges].sort(
      (one, two) => touches(one) - touches(two) || one.localeCompare(two),
    );
    focusRelations = edges.slice(0, NAME_CAP);
    focusUnnamedRelations = edges.length - focusRelations.length;

    sizeLabelPool(names, focusNames.length, NAME_CLASS);
    sizeLabelPool(relationLabels, focusRelations.length, RELATION_CLASS);
    focusNames.forEach((node, index) => {
      const element = names[index];
      if (element === undefined) return;
      const label = model.graph.getNodeAttribute(node, 'label');
      element.textContent = label;
      element.title = label;
    });
    focusRelations.forEach((edge, index) => {
      const element = relationLabels[index];
      if (element === undefined) return;
      const words = wordsOf(model.graph.getEdgeAttribute(edge, 'relationType')).label;
      element.textContent = words;
      element.title = words;
    });
  }

  const recount = (): void => {
    const passes = new Set<string>();
    model.graph.forEachNode((node, attrs) => {
      if (passesFilter(attrs)) passes.add(node);
    });

    // A focus lights what it draws, and `whole` lights what the two hops of the selection reach.
    const reach = mode === 'whole' ? reachOf(passes) : null;
    litNodes.clear();
    litEdges.clear();
    for (const node of passes) {
      if (mode === 'whole' ? reach === null || reach.has(node) : drawnNodes.has(node)) {
        litNodes.add(node);
      }
    }
    model.graph.forEachEdge((edge, _attrs, source, target) => {
      if (!litNodes.has(source) || !litNodes.has(target) || !typeShown(edge)) return;
      litEdges.add(edge);
    });

    counts = countShown(model.graph, mode === 'focus' ? litNodes : passes, hiddenRelations);
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

    nameFocus();
  };

  // A reducer replaces the datum and does not merge into it. Each one below spreads the original,
  // or Sigma finds no `x` and no `y` and refuses the node with an error.
  const sigma = new Sigma<NodeAttrs, EdgeAttrs>(model.graph, canvas, {
    // The container is measured in the constructor, while the chrome around it is still built.
    // A container of no height throws here. The `ResizeObserver` below gives the true size at the
    // first delivery, so a container that is not laid out yet is not a fault.
    allowInvalidContainer: true,

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
    minEdgeThickness: 2,

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

    nodeReducer: (node: string, data: NodeAttrs): Partial<NodeDisplayData> => {
      // The switch hides the ring. Unlike a filter, it takes the node out of the picture.
      if (!showUnplaced && data.unplaced) return { ...data, hidden: true, label: null };
      if (litNodes.has(node)) return { ...data };
      // A focus draws its own nodes and nothing else, so the rest stays out of the picture.
      if (mode !== 'whole') return { ...data, hidden: true, label: null };
      // A type that the filter puts out leaves the picture. A selection only dims the rest.
      if (!passesFilter(data)) return { ...data, hidden: true, label: null };
      return { ...data, color: dimOf(data.color), label: null };
    },

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
      if (litEdges.has(edge)) return { ...data };
      if (mode !== 'whole') return { ...data, hidden: true, label: null };
      // A line whose end the filter puts out has nothing to join.
      if (
        model.graph
          .extremities(edge)
          .some((end) => !passesFilter(model.graph.getNodeAttributes(end)))
      ) {
        return { ...data, hidden: true, label: null };
      }
      return { ...data, color: dimOf(data.color), label: null };
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
  hoverLabel.className = CANVAS_LABEL_CLASS;
  hoverLabel.hidden = true;
  layer.append(hoverLabel);
  overlay.append(layer);

  const markers: HTMLDivElement[] = [];

  const names: HTMLDivElement[] = [];
  const relationLabels: HTMLDivElement[] = [];

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

  // A name stands outside its node, on the side of the centre that the node is on, so that two
  // names on the two sides never meet. The names of one side are spread down where they would.
  const drawNames = (): void => {
    const spots = new Map<string, Coordinates>();
    const sides = {
      left: [] as { id: string; y: number }[],
      right: [] as { id: string; y: number }[],
    };
    const centreSpot = focusCentre === null ? null : viewportOf(focusCentre);
    for (const id of focusNames) {
      const spot = viewportOf(id);
      if (spot === null) continue;
      spots.set(id, spot);
      if (id === focusCentre || centreSpot === null) continue;
      (spot.x >= centreSpot.x ? sides.right : sides.left).push({ id, y: spot.y });
    }
    const spread = new Map([
      ...spreadDown(sides.left, NAME_GAP),
      ...spreadDown(sides.right, NAME_GAP),
    ]);

    focusNames.forEach((id, index) => {
      const element = names[index];
      if (element === undefined) return;
      const spot = spots.get(id);
      if (spot === undefined || outsideOf(spot)) {
        element.hidden = true;
        return;
      }
      element.hidden = false;
      const radius = sigma.scaleSize(sigma.getNodeDisplayData(id)?.size ?? 0) + NAME_OFFSET;
      const y = spread.get(id) ?? spot.y;
      if (id === focusCentre || centreSpot === null) {
        element.style.transform = `translate(${spot.x}px, ${spot.y - radius}px) translate(-50%, -100%)`;
      } else if (spot.x >= centreSpot.x) {
        element.style.transform = `translate(${spot.x + radius}px, ${y}px) translate(0, -50%)`;
      } else {
        element.style.transform = `translate(${spot.x - radius}px, ${y}px) translate(-100%, -50%)`;
      }
    });
  };

  // The type of a relation stands on its line and turns along it. The lines leave one node at
  // different angles, so the words along them keep apart.
  const drawRelations = (): void => {
    focusRelations.forEach((edge, index) => {
      const element = relationLabels[index];
      if (element === undefined) return;
      const from = viewportOf(model.graph.source(edge));
      const to = viewportOf(model.graph.target(edge));
      if (from === null || to === null) {
        element.hidden = true;
        return;
      }
      const slot = parallels.get(edge) ?? { index: 0, count: 1 };
      const spot = edgeLabelPlace(from, to, slot.index, slot.count);
      element.hidden = outsideOf(spot);
      element.style.transform = `translate(${spot.x}px, ${spot.y}px) translate(-50%, -50%) rotate(${spot.angle}rad)`;
    });
  };

  const drawOverlay = (): void => {
    if (destroyed) return;
    if (mode === 'focus') {
      drawNames();
      drawRelations();
    }

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
        hoverLabel.style.transform = canvasLabelTransform(x, y);
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

  /** Fits the camera to the nodes, and answers the ratio it chose. */
  const fitCamera = (ids: Iterable<string>, nearest: number): number => {
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
    if (minX > maxX) return camera.getState().ratio;
    // At a ratio of 1 the stored picture fills the shorter side of the canvas, so the longer side
    // shows the ratio times the aspect.
    const needed = Math.max(maxY - minY, (maxX - minX) / aspectNow()) * FIT_MARGIN;
    const ratio = Math.min(FARTHEST_RATIO, Math.max(NEAREST_RATIO, nearest, needed));
    moveCamera({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, ratio });
    return ratio;
  };

  let fitOfFocus = 1;

  const fitFocus = (): void => {
    usedAspect = aspectNow();
    fitOfFocus = fitCamera(drawnNodes, NEAREST_RATIO);
  };

  // Every write of a position goes through this one call, so Sigma meets one change of layout.
  const writePositions = (placed: ReadonlyMap<string, NodePosition>): void => {
    model.graph.updateEachNodeAttributes(
      (node, attrs) => {
        const target = placed.get(node) ?? positions.get(node);
        if (target === undefined || (attrs.x === target.x && attrs.y === target.y)) return attrs;
        return { ...attrs, x: target.x, y: target.y };
      },
      { attributes: ['x', 'y'] },
    );
  };

  // The centre of the focus stands at the middle of the stored picture. The result depends on
  // the corpus, the centre, the hops and the asks, so a reader meets the same picture at each open.
  const arrange = (): void => {
    if (mode !== 'focus' || focusCentre === null) {
      drawnNodes = new Set();
      writePositions(new Map());
      return;
    }
    const layout = layoutFocus({ centre: focusCentre, hops, expanded, neighbours: neighboursOf });
    const radiusY = FOCUS_RING * frameSpan;
    const placed = new Map<string, NodePosition>();
    for (const [id, offset] of layout.offsets) {
      placed.set(id, { x: frameX + offset.x * radiusY, y: frameY + offset.y * radiusY });
    }
    drawnNodes = new Set(layout.offsets.keys());
    hopsOf = layout.hopOf;
    writePositions(placed);
  };

  // A focus draws the nodes that pass the filter. A centre that the filter puts out leaves
  // nothing to draw around, so the canvas returns to the whole picture. A selection that is not
  // drawn is a lie on the screen.
  const redrawFocus = (): void => {
    if (mode !== 'focus') return;
    if (focusCentre !== null && !nodeConsidered(focusCentre)) {
      mode = 'whole';
      focusCentre = null;
      expanded = [];
      selection = null;
      writeSelectionAddress(null);
      announce();
    }
    arrange();
  };

  function expandableCount(): number {
    if (mode !== 'focus' || selection?.kind !== 'entity') return 0;
    if (!drawnNodes.has(selection.id)) return 0;
    return neighboursOf(selection.id).filter((neighbour) => !drawnNodes.has(neighbour)).length;
  }

  // Each value that did not change keeps its identity, so a consumer that memoises on `filter` or
  // on `selection` is not woken by a publish that only folded a panel. `graph-page.tsx` derives
  // every row of the rail from the filter.
  const viewOf = (): GraphView => ({
    mode,
    hops,
    focusDrawn: mode === 'focus' ? litNodes.size : 0,
    focusUnnamed,
    focusUnnamedRelations,
    expandable: expandableCount(),
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
  // A selection in the address opens the whole picture with that selection lit.
  // The restore does not go through `settle`, so nothing announces it here. `onSelect` seeds
  // every listener with the selection of the moment, and no subscriber can arrive too late.
  recount();
  nameCanvas();

  // The first render occurs inside the constructor of Sigma, so this listener never hears that
  // first frame. One refresh, after the listener exists, puts the ring and each marker up.
  sigma.on('afterRender', drawOverlay);
  sigma.refresh();

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
      // The first delivery gives the true shape of the canvas, and the camera fits to it.
      if (mode === 'focus' && aspectNow() !== usedAspect) fitFocus();
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

  // A new focus forgets the asks of the old one: its nodes are drawn from the centre again.
  const enterFocus = (id: string): void => {
    if (destroyed || !nodeConsidered(id)) return;
    mode = 'focus';
    focusCentre = id;
    expanded = [];
    arrange();
    const next: GraphSelection = { kind: 'entity', id };
    reveal(next);
    settle(next);
    fitFocus();
  };

  // The picking layer of Sigma answers with a dimmed node as well, so the guard is here.
  sigma.on('clickNode', ({ node }) => {
    if (destroyed || !nodeConsidered(node)) return;
    const next: GraphSelection = { kind: 'entity', id: node };
    // A click inside a focus keeps the focus and moves the camera to the node and its neighbours.
    // A click on the whole graph keeps the whole graph: the node and its neighbours are lit over
    // the dimmed rest. Only the focus bar (`focusOn`) opens a focus.
    if (mode === 'whole') {
      reveal(next);
      settle(next);
      return;
    }
    if (mode === 'focus' && drawnNodes.has(node)) {
      reveal(next);
      settle(next);
      const near = neighboursOf(node).filter((neighbour) => drawnNodes.has(neighbour));
      if (node === focusCentre) fitFocus();
      else fitCamera([node, ...near], fitOfFocus * NEAREST_FIT);
      return;
    }
    enterFocus(next.id);
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

  // A relation has no name of its own, so it is named by its type and its two ends.
  const nameHover = (next: { id: string; lines: readonly string[] } | null): void => {
    if (destroyed) return;
    hovered = next;
    // One element per line, so each one truncates on its own — a relation takes three.
    hoverLabel.replaceChildren(
      ...(next?.lines ?? []).map((line) => {
        const row = document.createElement('span');
        row.textContent = line;
        return row;
      }),
    );
    if (next === null) hoverLabel.hidden = true;
    // The label is placed on the next frame, with the ring and the markers, so one loop owns
    // every element over this canvas.
    sigma.refresh();
  };

  // **The name carries the count of relations.** This canvas sizes a node by its degree,
  // and a size alone is unreadable to a reader who cannot compare two discs. The words the hue
  // owes a reader live in the rail; the words the radius owes one live here.
  const nodeLines = (node: string): readonly string[] => {
    const lines = entityLines(
      model.graph.getNodeAttribute(node, 'label'),
      model.graph.getNodeAttribute(node, 'degree'),
    );
    const subordinates = hierarchy.subordinatesOf(node).length;
    if (subordinates === 0) return lines;
    return [...lines, subordinates === 1 ? '1 subordinate' : `${subordinates} subordinates`];
  };

  sigma.on('enterNode', ({ node }) => {
    if (!nodeConsidered(node)) return;
    nameHover({ id: node, lines: nodeLines(node) });
  });
  sigma.on('leaveNode', ({ node }) => {
    if (hovered?.id === node) nameHover(null);
  });

  sigma.on('enterEdge', ({ edge }) => {
    if (!edgeConsidered(edge)) return;
    const from = model.graph.getNodeAttribute(model.graph.source(edge), 'label');
    const to = model.graph.getNodeAttribute(model.graph.target(edge), 'label');
    const type = model.graph.getEdgeAttribute(edge, 'relationType');
    nameHover({ id: edge, lines: relationLines(from, wordsOf(type).label, to) });
  });
  sigma.on('leaveEdge', ({ edge }) => {
    if (hovered?.id === edge) nameHover(null);
  });

  // Each member does nothing after `destroy`: a call into a killed Sigma throws, and a write to
  // the workspace from a dead adapter keeps that value for each later open.
  const stopTheme = observeCanvasTheme((next) => {
    ground = next;
    dimCache.clear();
    model.setGround(next);
    sigma.refresh();
    publish();
  });

  const controller: GraphController = {
    get model() {
      return model;
    },
    focusOn: enterFocus,
    setHops: (next) => {
      if (destroyed || next === hops) return;
      hops = next;
      patchGraphWorkspace({ hops });
      if (mode !== 'focus') {
        publish();
        return;
      }
      expanded = [];
      arrange();
      settle(acceptable(selection));
      fitFocus();
    },
    openRelation: (id) => {
      if (destroyed || !edgeConsidered(id)) return;
      const next: GraphSelection = { kind: 'relation', id };
      reveal(next);
      settle(next);
    },
    expand: () => {
      if (destroyed || mode !== 'focus' || selection?.kind !== 'entity') return;
      if (!drawnNodes.has(selection.id)) return;
      if (!expanded.includes(selection.id)) expanded.push(selection.id);
      arrange();
      settle(acceptable(selection));
      fitFocus();
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
        redrawFocus();
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
      // A neighbour that only a hidden relation reached leaves the focus, and the layout runs again.
      redrawFocus();
      // A selected relation of a type that is now off is dropped, as the filter drops a node.
      settle(acceptable(selection));
    },
    setShowUnplaced: (show) => {
      if (destroyed || show === showUnplaced) return;
      showUnplaced = show;
      patchGraphWorkspace({ showUnplaced });
      redrawFocus();
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
    showWholeGraph: () => {
      if (destroyed) return;
      if (mode !== 'whole') {
        mode = 'whole';
        focusCentre = null;
        expanded = [];
        arrange();
        settle(acceptable(selection));
      }
      // External constraint: the reset of Sigma puts the centre at 0.5 and the ratio at 1,
      // which frames every node. The `updated` event stores it as any other move.
      if (motionOf() === 0) camera.setState({ x: 0.5, y: 0.5, ratio: 1, angle: 0 });
      else void camera.animatedReset({ duration: motionOf() });
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
      if (destroyed) return;
      // A camera that waits for the trailing store is the camera of the analyst. It is written
      // before the instance dies, and never after it.
      if (cameraTimer !== null) {
        window.clearTimeout(cameraTimer);
        cameraTimer = null;
        storeCamera();
      }
      destroyed = true;
      sizeObserver.disconnect();
      stopTheme();
      camera.off('updated', onCameraUpdated);
      sigma.off('afterRender', drawOverlay);
      listeners.clear();
      selectListeners.clear();
      markers.length = 0;
      names.length = 0;
      relationLabels.length = 0;
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
