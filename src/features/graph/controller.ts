import Sigma from 'sigma';
import { createEdgeArrowProgram } from 'sigma/rendering';
import type { Coordinates, EdgeDisplayData, NodeDisplayData } from 'sigma/types';

import { ARROW_LENGTH_RATIO, ARROW_WIDTH_RATIO } from '@/shared/canvas-arrow';
import {
  CANVAS_LABEL_CLASS,
  canvasLabelTransform,
  entityLines,
  relationLines,
} from '@/shared/canvas-label';
import type { Corpus, EntityPosition, TypeVocabulary } from '@/shared/read/model';
import { relationWording } from '@/shared/relation-words';
import { foldEveryUnit } from '@/shared/unit-folds';

import { FARTHEST_RATIO, NEAREST_RATIO, restorableCamera } from './camera-bounds';
import {
  buildGraphModel,
  dimmedColour,
  GROUND_HUE,
  repaintGraphModel,
  type EdgeAttrs,
  type GraphGround,
  type GraphModel,
  type NodeAttrs,
} from './model';
import { graphPositions } from './positions';
import { readSelectionAddress, writeSelectionAddress, type GraphSelection } from './selection';
import type { FilterState } from './type-filter';
import { patchGraphWorkspace, readGraphWorkspace } from './workspace';

export interface GraphView {
  readonly selection: GraphSelection | null;
  readonly filter: FilterState;
  readonly lit: number;
  readonly dimmed: number;
  /** How many elements carry a marker, and how many carry pending evidence and none. */
  readonly markersDrawn: number;
  readonly markersOverCap: number;
  /** The units whose subordinates the rail list shows. The canvas draws each unit either way. */
  readonly openUnits: ReadonlySet<string>;
  /** How many entities the layout run never placed, and the canvas draws on the band. */
  readonly unplaced: number;
  readonly railOpen: boolean;
  readonly railWidth: number;
}

export interface GraphController {
  readonly model: GraphModel;
  /** Departure: a selection moves no camera. It opens each unit that folds it in the list. */
  readonly select: (selection: GraphSelection | null) => void;
  readonly setUnitOpen: (unit: string, open: boolean) => void;
  readonly setFilter: (patch: Partial<FilterState>) => void;
  /** The rail was unfolded or folded. The workspace keeps it, so the next open finds it there. */
  readonly setRailOpen: (open: boolean) => void;
  /** The rail edge was dragged. The workspace keeps the width, as it keeps the fold. */
  readonly setRailWidth: (width: number) => void;
  readonly flyTo: (id: string) => void;
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

// How near a selection from the rail is approached. The whole picture stands at a ratio of 1, so
// this shows a node with the neighbourhood a selection lights and not the corpus. It is invented,
// and here a nearer camera buys no detail: a node carries the same words at every ratio.
const REACH_RATIO = 0.4;

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

/** Which ground the document has: the class on `documentElement`, and never React. */
const groundOf = (): GraphGround =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

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

  // **The positions are read one time.** A filter never moves a position, and an entity the
  // layout run did not place must stand in one place while the canvas lives. So nothing below
  // builds them again, and a theme change keeps them.
  const placement = graphPositions(corpus.entities, layout);
  const positions = placement.positions;

  let ground = groundOf();
  let model = buildGraphModel(corpus, positions, types, ground);
  const wordsOf = relationWording(corpus.relationTypes);

  const stored = readGraphWorkspace();
  let filter: FilterState = { hiddenTypes: [...stored.hiddenTypes] };
  let hidden = new Set(filter.hiddenTypes);
  let railOpen = stored.railOpen;
  let railWidth = stored.railWidth;

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
    // The fraction follows the ground, so the cache is emptied at each theme change below.
    const made = dimmedColour(colour, GROUND_HUE[ground], DIM_ALPHA[ground]);
    dimCache.set(colour, made);
    return made;
  };

  // The test is on the dim of the filter, and not on the dim of a selection. The two hops of a
  // selection dim as well, and they must not stop a click on a node on the other side.
  const passesFilter = (attrs: NodeAttrs): boolean => !hidden.has(attrs.entityType);

  const nodeConsidered = (node: string): boolean =>
    model.graph.hasNode(node) && passesFilter(model.graph.getNodeAttributes(node));

  /** A relation is in consideration while both of its endpoints are. */
  const edgeConsidered = (edge: string): boolean =>
    model.graph.hasEdge(edge) &&
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
        model.graph.forEachNeighbor(node, (neighbour) => {
          if (!passes.has(neighbour) || reach.has(neighbour)) return;
          reach.add(neighbour);
          next.push(neighbour);
        });
      }
      frontier = next;
    }
    return reach;
  };

  const recount = (): void => {
    const passes = new Set<string>();
    model.graph.forEachNode((node, attrs) => {
      if (passesFilter(attrs)) passes.add(node);
    });

    const reach = reachOf(passes);
    litNodes.clear();
    litEdges.clear();
    for (const node of passes) {
      if (reach === null || reach.has(node)) litNodes.add(node);
    }
    model.graph.forEachEdge((edge, _attrs, source, target) => {
      if (!litNodes.has(source) || !litNodes.has(target)) return;
      litEdges.add(edge);
    });

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
    defaultEdgeType: 'arrow',
    edgeProgramClasses: {
      // The default export of the arrow program is typed for a graph that declares no attributes
      // of its own. The factory beside it takes the two types of this graph, so the record needs
      // no assertion and this file keeps its rule of writing none.
      arrow: createEdgeArrowProgram<NodeAttrs, EdgeAttrs>({
        lengthToThicknessRatio: ARROW_LENGTH_RATIO,
        widenessToThicknessRatio: ARROW_WIDTH_RATIO,
      }),
    },

    // A relation is selected on the canvas, so a relation takes a click: the selection carries
    // `kind: 'relation'`, and the route draws that case as a report. This is not the case the
    // graph cannot draw: an M4 relation has no edge here, so no click can reach it.
    enableEdgeEvents: true,

    // The default edge hit box of Sigma is 1.7 and each edge has `size: 1`, so a relation was
    // near unclickable. The number is the full thickness, and it was measured in the browser one
    // pixel at a time. At 5 the band was 7px. At 10 the band is 10px, which is the rule.
    minEdgeThickness: 10,

    // The workspace carries `x`, `y` and `ratio`, and no angle. A rotation that the store
    // cannot carry would be lost at the reload, and the analyst would meet a picture that is not
    // the one that was left.
    enableCameraRotation: false,

    // External constraint: Sigma bounds no zoom by default, so a wheel or a pinch can reach a
    // ratio where the canvas shows empty ground. Sigma applies these bounds to each camera state.
    minCameraRatio: NEAREST_RATIO,
    maxCameraRatio: FARTHEST_RATIO,

    nodeReducer: (node: string, data: NodeAttrs): Partial<NodeDisplayData> => {
      if (litNodes.has(node)) return { ...data };
      // A filter dims. **It never hides.** So `hidden` stays false for a node the filter puts
      // out, it keeps its position, and only the paint changes. The label goes, because an
      // element that is out of consideration does not name itself.
      return { ...data, color: dimOf(data.color), label: null };
    },

    edgeReducer: (edge: string, data: EdgeAttrs): Partial<EdgeDisplayData> => {
      if (litEdges.has(edge)) return { ...data };
      return { ...data, color: dimOf(data.color), label: null };
    },
  });

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
  const place = (element: HTMLElement, point: Coordinates, size: number | null): void => {
    const { width, height } = sigma.getDimensions();
    const outside =
      point.x < -OVERLAY_MARGIN ||
      point.y < -OVERLAY_MARGIN ||
      point.x > width + OVERLAY_MARGIN ||
      point.y > height + OVERLAY_MARGIN;
    element.hidden = outside;
    if (outside) return;
    if (size !== null) {
      element.style.width = `${size}px`;
      element.style.height = `${size}px`;
    }
    element.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
  };

  const drawOverlay = (): void => {
    if (destroyed) return;

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

  // Each value that did not change keeps its identity, so a consumer that memoises on `filter` or
  // on `selection` is not woken by a publish that only folded a panel. `graph-page.tsx` derives
  // every row of the rail from the filter.
  const viewOf = (): GraphView => ({
    selection,
    filter,
    lit,
    dimmed,
    markersDrawn: markerTargets.length,
    markersOverCap,
    openUnits: folds.open,
    unplaced: placement.unplaced,
    railOpen,
    railWidth,
  });

  const publish = (): void => {
    const view = viewOf();
    // The set is copied, because a listener may unsubscribe inside its own call.
    for (const listener of [...listeners]) listener(view);
  };

  const announce = (): void => {
    for (const listener of [...selectListeners]) listener(selection);
  };

  // Departure: it moves no camera. `flyTo` and `showWholeGraph` are the controls that move it.
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

  // The picking layer of Sigma answers with a dimmed node as well, because a filter dims and
  // never hides, so the guard is here. There is no camera call in this handler, and that absence
  // is the rule.
  sigma.on('clickNode', ({ node }) => {
    if (destroyed || !nodeConsidered(node)) return;
    const next: GraphSelection = { kind: 'entity', id: node };
    reveal(next);
    settle(next);
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

  // A theme change moves the palette and nothing else: the record, the topology and the positions
  // are the same, so the paint is written over the graph that is already drawn. Nothing is built
  // again, so no node moves, and the camera and the selection both hold. `settle` refreshes.
  const themeObserver = new MutationObserver(() => {
    if (destroyed) return;
    const next = groundOf();
    if (next === ground) return;
    ground = next;
    dimCache.clear();
    model = repaintGraphModel(model, types, ground);
    settle(acceptable(selection));
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // Each member does nothing after `destroy`: a call into a killed Sigma throws, and a write to
  // the workspace from a dead adapter keeps that value for each later open.
  const controller: GraphController = {
    get model() {
      return model;
    },
    select: (next) => {
      if (destroyed) return;
      // A control names an element, and this file states whether that element can take the
      // selection. Departure: the camera stays where it is; a control that moves it calls
      // `flyTo` or `showWholeGraph`.
      reveal(next);
      settle(acceptable(next));
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
      }
      // **A filter that excludes the selection drops the selection.**
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
    flyTo: (id) => {
      if (destroyed) return;
      const point = framedPointOf(id);
      if (point === null) return;
      // The approach only ever moves nearer: a smaller ratio is a nearer camera, and a
      // selection must never undo the zoom the analyst chose.
      const ratio = Math.min(camera.getState().ratio, REACH_RATIO);
      void camera.animate({ x: point.x, y: point.y, ratio });
    },
    showWholeGraph: () => {
      if (destroyed) return;
      // External constraint: the reset of Sigma puts the centre at 0.5 and the ratio at 1,
      // which frames every node. The `updated` event stores it as any other move.
      void camera.animatedReset();
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
      themeObserver.disconnect();
      camera.off('updated', onCameraUpdated);
      sigma.off('afterRender', drawOverlay);
      listeners.clear();
      selectListeners.clear();
      markers.length = 0;
      // The layer is the one node this file added to the element of the caller.
      layer.remove();
      if (mounted.get(canvas) === controller) mounted.delete(canvas);
      sigma.kill();
    },
  };

  mounted.set(canvas, controller);
  return controller;
}
