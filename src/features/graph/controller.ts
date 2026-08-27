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
import type { Corpus, TypeVocabulary } from '@/shared/read/model';

import { emitGraphSelection, type GraphSelection } from './bridge';
import { standInPositions } from './layout';
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
import { patchGraphWorkspace, readGraphWorkspace, type GraphWorkspace } from './workspace';

export type FilterState = Pick<GraphWorkspace, 'hiddenTypes'>;

export interface GraphView {
  /** The bridge declares it, and the route reads the same declaration. */
  readonly selection: GraphSelection | null;
  readonly filter: FilterState;
  readonly lit: number;
  readonly dimmed: number;
  /** How many elements carry a marker, and how many carry pending evidence and none. */
  readonly markersDrawn: number;
  readonly markersOverCap: number;
  readonly railOpen: boolean;
}

export interface GraphController {
  readonly model: GraphModel;
  /** A control selects here. **It moves no camera.** `flyTo` is the control that moves it. */
  readonly select: (selection: GraphSelection | null) => void;
  readonly setFilter: (patch: Partial<FilterState>) => void;
  /** The rail was unfolded or folded. The workspace keeps it, so the next open finds it there. */
  readonly setRailOpen: (open: boolean) => void;
  readonly flyTo: (id: string) => void;
  readonly subscribe: (listener: (view: GraphView) => void) => () => void;
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

// The dim keeps this much of the colour. It is measured against the two grounds of
// `src/index.css`: a dimmed element reads at about 1.9:1 on light and 2.3:1 on dark, against
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
  types: TypeVocabulary,
): GraphController {
  mounted.get(canvas)?.destroy();

  // **The positions are computed one time.** A filter never moves a position, and a second run of
  // a layout gives another picture. So nothing below computes them again, and a theme change
  // keeps them.
  const positions = standInPositions(corpus);

  let ground = groundOf();
  let model = buildGraphModel(corpus, positions, types, ground);

  const stored = readGraphWorkspace();
  let filter: FilterState = { hiddenTypes: [...stored.hiddenTypes] };
  let hidden = new Set(filter.hiddenTypes);
  let railOpen = stored.railOpen;

  let destroyed = false;
  const listeners = new Set<(view: GraphView) => void>();

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

  const nodePassesFilter = (node: string): boolean =>
    model.graph.hasNode(node) && passesFilter(model.graph.getNodeAttributes(node));

  /** A relation is in consideration while both of its endpoints are. */
  const edgePassesFilter = (edge: string): boolean =>
    model.graph.hasEdge(edge) &&
    nodePassesFilter(model.graph.source(edge)) &&
    nodePassesFilter(model.graph.target(edge));

  let selection: GraphSelection | null = null;

  // Without this, the marker, the ring and the detail all keep working on an element that the
  // filter puts out of consideration.
  const acceptable = (candidate: GraphSelection | null): GraphSelection | null => {
    if (candidate === null) return null;
    if (candidate.kind === 'entity') return nodePassesFilter(candidate.id) ? candidate : null;
    return edgePassesFilter(candidate.id) ? candidate : null;
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

    nodeReducer: (node: string, data: NodeAttrs): Partial<NodeDisplayData> => {
      if (litNodes.has(node)) return { ...data };
      // A filter dims. **It never hides.** So `hidden` stays false, the node keeps
      // its position, and only the paint changes. The label goes, because an element that is out
      // of consideration does not name itself.
      return { ...data, color: dimOf(data.color), label: null };
    },

    edgeReducer: (edge: string, data: EdgeAttrs): Partial<EdgeDisplayData> => {
      if (litEdges.has(edge)) return { ...data };
      return { ...data, color: dimOf(data.color), label: null };
    },
  });

  const camera = sigma.getCamera();
  if (stored.camera !== null) {
    // **The stored camera is read behind a guard.** The workspace holds that guard, and it
    // gives `null` for every record it does not know.
    camera.setState({ x: stored.camera.x, y: stored.camera.y, ratio: stored.camera.ratio });
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
    railOpen,
  });

  const publish = (): void => {
    const view = viewOf();
    // The set is copied, because a listener may unsubscribe inside its own call.
    for (const listener of [...listeners]) listener(view);
  };

  const readAddress = (): GraphSelection | null => {
    const params = new URLSearchParams(window.location.search);
    // An empty value is not an identifier, and a typed address can still carry one. Read as an
    // entity, `acceptable` drops it and the relation beside it is never read, so a relation
    // cannot survive a reload.
    const entity = params.get('entity');
    if (entity !== null && entity !== '') return { kind: 'entity', id: entity };
    const relation = params.get('relation');
    if (relation !== null && relation !== '') return { kind: 'relation', id: relation };
    return null;
  };

  // The write bypasses the router: a write through the router re-renders the route, which
  // destroys the canvas and starts the layout again.
  const writeAddress = (current: GraphSelection | null): void => {
    const url = new URL(window.location.href);
    url.searchParams.delete('entity');
    url.searchParams.delete('relation');
    if (current !== null) url.searchParams.set(current.kind, current.id);
    // The state of the router is carried through untouched. A `null` here would empty it.
    const state: unknown = window.history.state;
    window.history.replaceState(state, '', url);
  };

  // It moves no camera. `flyTo` is the one control that may move it.
  const settle = (next: GraphSelection | null): void => {
    const changed = !sameSelection(next, selection);
    selection = next;
    if (changed) {
      writeAddress(selection);
      // The graph announces the selection on an event of the window, so the route needs no
      // property, and the memoised canvas is never re-rendered.
      emitGraphSelection(selection);
    }
    recount();
    sigma.refresh();
    publish();
  };

  // The address is read one time. A selection that names no drawn element, or one that the stored
  // filter excludes, is dropped here.
  const restored = readAddress();
  selection = acceptable(restored);
  if (!sameSelection(restored, selection)) {
    // The address named an element that this graph does not mark. The address is corrected, so
    // that the picture and the address never state two different things.
    writeAddress(selection);
  }
  // The restore does not go through `settle`, which is the only other caller, so nothing else
  // announces it. The bridge holds the value for a subscriber that attaches after the mount:
  // the canvas is a child and its effect runs first.
  emitGraphSelection(selection);
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
    if (destroyed || !nodePassesFilter(node)) return;
    settle({ kind: 'entity', id: node });
  });

  sigma.on('clickEdge', ({ edge }) => {
    if (destroyed || !edgePassesFilter(edge)) return;
    settle({ kind: 'relation', id: edge });
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

  sigma.on('enterNode', ({ node }) => {
    if (!nodePassesFilter(node)) return;
    // **The name carries the count of relations.** This canvas sizes a node by its degree,
    // and a size alone is unreadable to a reader who cannot compare two discs. The words the hue
    // owes a reader live in the rail; the words the radius owes one live here.
    nameHover({
      id: node,
      lines: entityLines(
        model.graph.getNodeAttribute(node, 'label'),
        model.graph.getNodeAttribute(node, 'degree'),
      ),
    });
  });
  sigma.on('leaveNode', ({ node }) => {
    if (hovered?.id === node) nameHover(null);
  });

  sigma.on('enterEdge', ({ edge }) => {
    if (!edgePassesFilter(edge)) return;
    const from = model.graph.getNodeAttribute(model.graph.source(edge), 'label');
    const to = model.graph.getNodeAttribute(model.graph.target(edge), 'label');
    const type = model.graph.getEdgeAttribute(edge, 'relationType');
    nameHover({ id: edge, lines: relationLines(from, type, to) });
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
      // selection. **The camera stays where it is**; a control that must move it calls `flyTo`.
      settle(acceptable(next));
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
    flyTo: (id) => {
      if (destroyed) return;
      const point = framedPointOf(id);
      if (point === null) return;
      // A control of the analyst may move the camera. The zoom stays: what "near enough"
      // means is a camera value that nobody has decided.
      void camera.animate({ x: point.x, y: point.y });
    },
    subscribe: (listener) => {
      if (destroyed) return NO_OP;
      listeners.add(listener);
      // A component that subscribes after the canvas is built has already missed the restore of
      // the address. So the listener is called here with the view of this moment.
      listener(viewOf());
      return () => listeners.delete(listener);
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
