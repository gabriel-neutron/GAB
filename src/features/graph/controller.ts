/**
 * One Sigma instance, driven directly.
 *
 * Built from `docs/graph-surface.md` §4.3, §2 (UC1 to UC5), §3.3, §4.6, §5.1, §5.2, §5.3, §5.4,
 * §5.5, §6, §7 and §8 step 3. It also obeys ADR 0004 §2 and §3, and every rule of `CANVAS.md`.
 * This file owns the instance, the selection, the filter, the camera, the marker layer, the
 * workspace and the disposal. It gives a handle to the other components of the surface.
 * **No other file uses the library.**
 *
 * **This file contains no React value, and it causes no render.** ADR 0004 §3. It imports no
 * React module and it holds no JSX. The mount and the cleanup are parts of `mountGraph`.
 *
 * **It computes no position and it stores none.** `./layout` gives a stand-in for each node,
 * which is scaffolding for **#35** (§6). The positions are computed one time, at the mount, so
 * that no later act of this file moves a node — §5.2 and UC4.
 *
 * **It reads the theme from the class on `documentElement`, with an observer, and never from
 * React** — `CANVAS.md`. `./model` holds two palettes, one for each ground, because a Sigma canvas
 * has no imagery and the dark hues cannot be read on the light ground.
 *
 * **The address holds the selection, and this file writes it with `history.replaceState`.** §7
 * records why: a write through the router re-renders the route, which destroys the canvas and
 * starts the layout again. **That is a report to #33, and it settles nothing.** The two search
 * keys, `entity` and `relation`, are the smallest extension of the `entity` key that the map
 * already writes; which keys the address carries is #33's to settle.
 *
 * **This file owns no part of the screen except the marker layer.** It states each count it
 * cannot draw on the view. The legend that drew them is gone — #82 B1 to B11.
 */

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
import type { Corpus } from '@/shared/fixtures/types';

import { emitGraphSelection, type GraphSelection } from './bridge';
import { standInPositions } from './layout';
import {
  buildGraphModel,
  dimmedColour,
  GROUND_HUE,
  GRAPH_PALETTES,
  type EdgeAttrs,
  type GraphGround,
  type GraphModel,
  type NodeAttrs,
} from './model';
import { patchGraphWorkspace, readGraphWorkspace, type GraphWorkspace } from './workspace';

/**
 * The filter of the surface, in the polarity §5.2 gives it.
 *
 * **It is taken from the record that stores it, and it restates no field.** `./workspace` holds
 * the shape and the reason for the polarity, and a copy of both here would let the two disagree.
 *
 * **A degree floor and a pending switch were fields here, and no control wrote either.** §5.2
 * says a control that can exclude everything carries the way back, and the rail carries it for
 * the types alone: a stored degree floor dimmed the whole corpus on every open with no way back.
 * A pending switch also presumes an answer to **#42**, which is open. Do not restore either
 * without a control and a decision.
 *
 * **The way back from an all-grey screen is `setFilter`**, with each field at the value of
 * `DEFAULT_GRAPH_WORKSPACE` in `./workspace` — §5.2. The prototype reached a screen with nothing
 * lit, and that screen survived a reload, because the filter is stored. So the control that can
 * exclude everything reads those defaults from that one record, and invents no second set.
 */
export type FilterState = Pick<GraphWorkspace, 'hiddenTypes'>;

/**
 * What each subscriber reads. The shape is the one §4.3 quotes.
 *
 * **It carries no detail**, because `features/detail` owns that surface. It carries no model
 * either: the model is on the handle, because a rail reads thousands of rows from it and a view
 * that carries them would be copied at each publish.
 *
 * `lit` and `dimmed` count **elements**: a node and an edge each count as one, so the two figures
 * together are the whole picture. The legend that stated them is gone — #82 B7.
 */
export interface GraphView {
  /** The shape §4.3 quotes. `./bridge` declares it, and the route reads the same declaration. */
  readonly selection: GraphSelection | null;
  readonly filter: FilterState;
  readonly lit: number;
  readonly dimmed: number;
  /**
   * Whether the rail is unfolded.
   *
   * **They are on the view because they are the workspace, and this file owns the workspace** —
   * §5.4 and ADR 0004 §7. `graph-page.tsx` held them in React state as well, seeded from the same
   * record and patched on each change, so one value sat in two stores. §4.3 quotes a view without
   * them; the two keys are the smallest extension that removes the second store, and it is
   * reported under ASK.
   */
  readonly railOpen: boolean;
}

/**
 * What the rail and the route use to drive the graph.
 *
 * **`subscribe` calls its listener at once, with the view of that moment** — `CANVAS.md`: a
 * component that subscribes after the canvas is built has already missed the restore of the
 * address. So no caller must remember to read a seed first.
 *
 * **`model` is a getter, and a publish can replace what it answers.** A theme change builds the
 * model again, because the paint of each node is in the model (§4.2) and only `./model` knows the
 * rule that gives a node its colour. A caller that draws from the model reads it again at each
 * publish.
 */
export interface GraphController {
  readonly model: GraphModel;
  /** A control selects here. **It moves no camera** — §5.1. `flyTo` is the control that moves it. */
  readonly select: (selection: GraphSelection | null) => void;
  readonly setFilter: (patch: Partial<FilterState>) => void;
  /** The rail was unfolded or folded. The workspace keeps it, so the next open finds it there. */
  readonly setRailOpen: (open: boolean) => void;
  readonly flyTo: (id: string) => void;
  readonly subscribe: (listener: (view: GraphView) => void) => () => void;
  readonly destroy: () => void;
}

/**
 * How many elements carry a marker of UC5 at one time.
 *
 * **250 is the number the accepted prototype used, and it is chosen here** — §3.3. A marker drawn
 * as an element of the page, and positioned over its element on each frame, does not scale. The
 * remainder is stated on the view, and §4.5 draws it.
 *
 * **This number guesses at #10**, which owns how a pending proposal appears and which 250 carry a
 * marker where the cap bites. The cap is a report to that ticket and not an answer to it.
 */
const MARKER_CAP = 250;

/**
 * How far a selection lights the graph around itself. UC2: two hops.
 */
const HOPS = 2;

/**
 * How much of its own colour a dimmed element keeps, on each ground.
 *
 * **A dim that reaches the ground is a hide, and §5.2 forbids a hide.** That was the defect: one
 * value of 0.2, for both grounds, put a dimmed element at the colour of the near-white background
 * of the light theme. A browser check of `/graph` read the canvas as empty while 33 of the 42
 * elements were dimmed by the two hops of UC2. UC4 says an excluded element goes **faint**, and
 * faint is present and clearly secondary, and never absent.
 *
 * **The two grounds take two values, for the same reason that `./model` holds two palettes.** The
 * light ground blends towards near-white, where a hue loses its separation quickly, so it keeps
 * more of the colour. The dark ground blends towards near-black, where a hue keeps more of it.
 *
 * The numbers are chosen here, against the two backgrounds of `src/index.css`: a dimmed element
 * reads at about 1.9:1 on the light ground and about 2.3:1 on the dark one, against about 4.9:1
 * and 6.7:1 for the same element while it is lit. A lit element therefore still reads as clearly
 * stronger, which is what makes the dim state something.
 *
 * **No ticket owns these two values, and they guess at no open question.** §5.2 and UC4 give the
 * rule that a filter dims and never hides, and §4.2 gives the colour rule, so the rule is already
 * decided. The two values are **measured** against each ground, as the ratios above record, and
 * a value that a measurement gives is not a guess. Measure again before you change one.
 */
const DIM_ALPHA: Readonly<Record<GraphGround, number>> = { light: 0.45, dark: 0.4 };

/**
 * How long this file waits before it stores a camera, in milliseconds. **The number is chosen
 * here.** The camera of Sigma reports `updated` on every frame of a pan, and a write to
 * `localStorage` on every frame blocks the main thread. The store is therefore a trailing wait,
 * and `destroy` writes the camera that is still waiting.
 */
const CAMERA_STORE_WAIT = 250;

/** The size that stands for "this file has used no size yet". A box is never negative. */
const NO_SIZE = -1;

/** How far outside the canvas an overlay element may sit before it is not drawn, in pixels. */
const OVERLAY_MARGIN = 32;

/**
 * The layer that carries the ring and the markers. It fills the overlay element and it takes no
 * pointer event, so a drag that starts on it still moves the graph below — §5.5.
 */
const LAYER_CLASS = 'pointer-events-none absolute inset-0 overflow-hidden';

/**
 * One marker of UC5. **The appearance is #10's to settle** (§7), so this is the smallest mark
 * that a person can see: one square of `--candidate`, which is the token for evidence that is not
 * promoted, with a hairline of the ground around it so that it reads on a dark node. §8 step 7
 * asks for a **node program** instead of an element of the page, and this file writes none: a
 * node program is a WebGL program, a shader pair and a buffer layout, which is a surface of its
 * own and a decision about how a proposal appears. The cost of the element is the cap above.
 *
 * **It sits at the upper right of the dot and no longer on its centre** — #91 row A9. The operator
 * ruled the idea right and the form wrong, and chose this shape from three prototypes on the
 * branch `proto/marks-2026-08-18`. A mark on the centre covers the very thing it marks.
 */
const MARKER_CLASS =
  'pointer-events-none absolute top-0 left-0 size-2 rounded-none border border-background bg-candidate';

/**
 * How far the marker stands from the centre of the dot, in pixels, on each axis — #91 A9.
 *
 * It is a fixed offset and not a fraction of the radius of the node: a hub of two thousand
 * relations would otherwise push its badge far out into the picture, and a leaf would keep the
 * badge on top of itself.
 */
const MARKER_OFFSET = 7;

/**
 * The ring of §5.1. It is drawn here, and never with the `highlighted` flag of Sigma: that flag
 * makes the library draw its own hover card, in colours that no token of this repository reaches.
 */
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

/** Which ground the document has. `CANVAS.md`: the class on `documentElement`, and never React. */
const groundOf = (): GraphGround =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const sameSelection = (one: GraphSelection | null, two: GraphSelection | null): boolean =>
  one === null || two === null ? one === two : one.kind === two.kind && one.id === two.id;

/** Two hidden sets are the same set while they hold the same names in the same order. */
const sameTypes = (one: readonly string[], two: readonly string[]): boolean =>
  one.length === two.length && one.every((type, index) => type === two[index]);

/**
 * Each live mount, by the element that it owns.
 *
 * **The mount does the same thing each time** — §5.3. React invokes an effect two times in
 * development, and a second instance on one element makes the browser drop the older WebGL
 * context. That looks like a blank canvas, and it is not one. So a second mount destroys the
 * first, and `destroy` removes the entry it owns and no other.
 */
const mounted = new WeakMap<HTMLElement, GraphController>();

/**
 * Builds the graph, and gives the handle that drives it.
 *
 * `canvas` is the element that Sigma takes and owns. Its size comes from the layout around it,
 * and never from its content.
 *
 * `overlay` is the element that carries the ring and the markers. **It sits over the canvas, at
 * the same place and the same size, and it is positioned** — the layer inside it is absolute.
 */
export function mountGraph(
  canvas: HTMLElement,
  overlay: HTMLElement,
  corpus: Corpus,
): GraphController {
  mounted.get(canvas)?.destroy();

  // **The positions are computed one time.** §5.2: a filter never moves a position, and §3.2
  // proves that a second run of a layout gives another picture. So nothing below computes them
  // again, and a theme change keeps them.
  const positions = standInPositions(corpus);

  let ground = groundOf();
  let model = buildGraphModel(corpus, positions, GRAPH_PALETTES[ground]);

  const stored = readGraphWorkspace();
  let filter: FilterState = { hiddenTypes: [...stored.hiddenTypes] };
  let hidden = new Set(filter.hiddenTypes);
  let railOpen = stored.railOpen;

  let destroyed = false;
  const listeners = new Set<(view: GraphView) => void>();

  // The elements the filter keeps lit, and the elements the two hops of UC2 keep lit with it.
  const litNodes = new Set<string>();
  const litEdges = new Set<string>();
  let lit = 0;
  let dimmed = 0;

  /** The elements that carry a marker on this frame, and how many get none. §3.3. */
  let markerTargets: readonly string[] = [];

  /**
   * What the pointer is over, and the words the label draws for it — #82 A6 and A10.
   *
   * **It is not on the view, and it never publishes.** A hover changes as fast as the pointer
   * moves, and a publish on each one would run every subscriber of this handle at that rate. The
   * label is drawn over the canvas by this file, exactly as the ring and the markers are.
   */
  let hovered: { readonly id: string; readonly lines: readonly string[] } | null = null;

  /** One dimmed colour for each colour of the palette. A reducer runs for each element, each frame. */
  const dimCache = new Map<string, string>();
  const dimOf = (colour: string): string => {
    const held = dimCache.get(colour);
    if (held !== undefined) return held;
    // The fraction follows the ground, so the cache is emptied at each theme change below.
    const made = dimmedColour(colour, GROUND_HUE[ground], DIM_ALPHA[ground]);
    dimCache.set(colour, made);
    return made;
  };

  /**
   * **The filter decides what is in consideration, and the selection decides what is in focus.**
   * The two dims are not one. §5.1 puts an element that the **filter** dims out of reach, so this
   * test is the one that a click and a control obey. The two hops of UC2 dim as well, and they
   * must not stop the analyst from selecting a node on the other side of the picture.
   */
  const passesFilter = (attrs: NodeAttrs): boolean => !hidden.has(attrs.entityType);

  const nodePassesFilter = (node: string): boolean =>
    model.graph.hasNode(node) && passesFilter(model.graph.getNodeAttributes(node));

  /** A relation is in consideration while both of its endpoints are. */
  const edgePassesFilter = (edge: string): boolean =>
    model.graph.hasEdge(edge) &&
    nodePassesFilter(model.graph.source(edge)) &&
    nodePassesFilter(model.graph.target(edge));

  let selection: GraphSelection | null = null;

  /**
   * **A dimmed element takes no selection, and a filter that excludes the selection drops it** —
   * §5.1. Otherwise the marker, the ring and the detail all keep working on an element that the
   * analyst has just put out of consideration.
   */
  const acceptable = (candidate: GraphSelection | null): GraphSelection | null => {
    if (candidate === null) return null;
    if (candidate.kind === 'entity') return nodePassesFilter(candidate.id) ? candidate : null;
    return edgePassesFilter(candidate.id) ? candidate : null;
  };

  /**
   * The nodes within two hops of the selection, or `null` while nothing is selected — UC2.
   *
   * **The walk steps through the nodes that pass the filter only.** Out of consideration is out of
   * reach, so an excluded node carries no neighbourhood either.
   */
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

  /** What is lit, what is dimmed, and what carries a marker. It reads the graph and paints nothing. */
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
    // The order is the order of the read, so the same corpus gives the same 250 on every open.
    // **Which 250 is #10's to settle.**
    //
    // **The remainder is no longer stated anywhere.** This file counted it and the legend drew it;
    // the operator removed the legend — #82 B8 — so an element over the cap now carries no marker
    // and no report. **#10 must say what happens past 250.**
    markerTargets = targets.slice(0, MARKER_CAP);
    sizeMarkerPool(markerTargets.length);
  };

  /**
   * **A reducer replaces the datum. It does not merge into it** — §5.3. Each one below spreads the
   * original, so the position of the node survives. Without the spread Sigma finds no `x` and no
   * `y`, and it refuses the node with an error.
   */
  const sigma = new Sigma<NodeAttrs, EdgeAttrs>(model.graph, canvas, {
    // The container is measured in the constructor, while the chrome around it is still built.
    // A container of no height throws here. The `ResizeObserver` below gives the true size at the
    // first delivery, so a container that is not laid out yet is not a fault.
    allowInvalidContainer: true,

    // §2 and ADR 0004 §4: this canvas is for macro structure, and not for reading labels. The
    // label colour of the library is one fixed value that no token of this repository reaches, so
    // a label drawn here is unreadable on one of the two grounds.
    renderLabels: false,

    // **The hover card of the library is switched off, and this file draws the name itself.**
    // `renderLabels: false` does not reach it: the card is drawn by its own path, in the same
    // fixed colour, and it put black text on a white box over this canvas. The overlay label above
    // takes its place, in the tokens of the theme and in the recipe the map shares — #82 A6, A10.
    defaultDrawNodeHover: () => undefined,

    // **A relation says which way it points** — #88 row A5. The head is at the end the relation
    // arrives at, and `shared/canvas-arrow.ts` states its shape for this canvas and for the map.
    // Sigma reads the program from the `type` of an edge, and this default reaches every edge that
    // states none, so no edge datum and no reducer below changes.
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

    // A relation is selected on the canvas, so a relation takes a click — §4.3, whose selection
    // carries `kind: 'relation'`, and §4.7, which draws that case as a report. This is not UC3:
    // the M4 relation of UC3 has no edge here, so no click can reach it.
    enableEdgeEvents: true,

    // **A line needs a hit box of about 5px on each side** — `CANVAS.md`. The default of Sigma is
    // 1.7, and each edge has `size: 1`, so a relation was near unclickable.
    //
    // **The number is the full thickness, and not the half-width.** It was measured in the
    // browser, and not read from the shader: a click was walked across a relation one pixel at a
    // time. At 5 the band was 7px, which is 3.5px on each side. At 10 the band is 10px, which is
    // the rule. Sigma picks on the geometry it draws, so the line is now 10px wide as well.
    minEdgeThickness: 10,

    // The workspace carries `x`, `y` and `ratio`, and no angle — §5.4. A rotation that the store
    // cannot carry would be lost at the reload, and the analyst would meet a picture that is not
    // the one that was left.
    enableCameraRotation: false,

    nodeReducer: (node: string, data: NodeAttrs): Partial<NodeDisplayData> => {
      if (litNodes.has(node)) return { ...data };
      // A filter dims. **It never hides** — §5.2 and UC4. So `hidden` stays false, the node keeps
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
    // **The stored camera is read behind a guard** — §5.4. `./workspace` holds that guard, and it
    // gives `null` for every record it does not know.
    camera.setState({ x: stored.camera.x, y: stored.camera.y, ratio: stored.camera.ratio });
  }

  /**
   * The layer of the overlay. One element carries the ring and each marker, so `destroy` removes
   * one node and leaves the element of the caller as it found it.
   */
  const layer = document.createElement('div');
  layer.className = LAYER_CLASS;
  const ring = document.createElement('div');
  ring.className = RING_CLASS;
  ring.hidden = true;
  layer.append(ring);

  /**
   * The name a pointer draws — #82 rows A6 and A10, and #91.
   *
   * **It replaces the hover card of Sigma**, which `renderLabels: false` does not switch off. That
   * card draws in one fixed colour of the library, so it put black text on a white box over this
   * dark canvas. `defaultDrawNodeHover` below switches it off, and `shared/canvas-label.ts` states
   * how this one looks — the same recipe the map reads, so the two surfaces name a thing the same
   * way.
   *
   * **It names a relation as well as a node** — #82 A6, which the operator kept and extended.
   */
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

  /**
   * Where one element sits, in the **framed** coordinate system.
   *
   * **`getNodeDisplayData` answers in that system** — §5.3. Its answer is paired with
   * `framedGraphToViewport` below, and **never** with `graphToViewport`. The wrong pair puts every
   * overlay element near the middle of the canvas, and it looks correct for each node that is near
   * the origin of the graph.
   */
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

  /**
   * Draws the ring and each marker over the canvas.
   *
   * **A ring is drawn only around a lit element** — §5.1. The test below is on what is lit, and
   * never on what exists.
   */
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
      // #91 A9: the badge stands clear of the dot, at its upper right.
      const at = sigma.framedGraphToViewport(point);
      place(element, { x: at.x + MARKER_OFFSET, y: at.y - MARKER_OFFSET }, null);
    });
  };

  /**
   * The view of this moment.
   *
   * **Each value that did not change keeps its identity.** The view itself is a new object at each
   * publish, and `filter` and `selection` are not: a publish reads the two variables and builds
   * neither. `setFilter` below replaces the filter object only where the hidden set differs, and
   * `acceptable` answers with the selection it was given. A consumer that memoises on the filter
   * or on the selection is therefore not woken by a publish that only folded a panel — which was
   * the defect: `graph-page.tsx` derived every row of the rail again for one click on a chevron.
   */
  const viewOf = (): GraphView => ({
    selection,
    filter,
    lit,
    dimmed,
    railOpen,
  });

  const publish = (): void => {
    const view = viewOf();
    // The set is copied, because a listener may unsubscribe inside its own call.
    for (const listener of [...listeners]) listener(view);
  };

  /**
   * Reads the selection from the address, one time, at the mount.
   *
   * **Every value from the address is validated before its first use** — the identifier goes
   * through `acceptable`, which drops one that names no element of this graph and one that the
   * filter excludes.
   */
  const readAddress = (): GraphSelection | null => {
    const params = new URLSearchParams(window.location.search);
    const entity = params.get('entity');
    if (entity !== null) return { kind: 'entity', id: entity };
    const relation = params.get('relation');
    if (relation !== null) return { kind: 'relation', id: relation };
    return null;
  };

  /**
   * **The write bypasses the router, and it is a report to #33** — §7. A write through the router
   * re-renders the route, which destroys the canvas and starts the layout again. This settles
   * nothing: where the view state lives is that ticket's to answer.
   */
  const writeAddress = (current: GraphSelection | null): void => {
    const url = new URL(window.location.href);
    url.searchParams.delete('entity');
    url.searchParams.delete('relation');
    if (current !== null) url.searchParams.set(current.kind, current.id);
    // The state of the router is carried through untouched. A `null` here would empty it.
    const state: unknown = window.history.state;
    window.history.replaceState(state, '', url);
  };

  /**
   * The one path that changes what is on the screen. It takes the selection that is already
   * accepted, counts again, paints again, and publishes one view.
   *
   * **It moves no camera.** §5.1: the camera never moves for a selection made on the canvas. The
   * the one control that may move it is `flyTo`, and it is called by a
   * control of the analyst.
   */
  const settle = (next: GraphSelection | null): void => {
    const changed = !sameSelection(next, selection);
    selection = next;
    if (changed) {
      writeAddress(selection);
      // §4.6: the graph announces the selection on an event of the window, so the route needs no
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
  // **The restore is announced, and that is not optional.** `settle` is the only other caller of
  // this function, and the restore does not go through it, so nothing said what this graph
  // accepted. A neighbour that reads the address itself then drew the element this line above
  // just dropped. `./bridge` holds this value for a subscriber that attaches after the mount —
  // `CANVAS.md` requires that seam, because the canvas is a child and its effect runs first.
  emitGraphSelection(selection);
  recount();

  /**
   * **The first render occurs inside the constructor** — §5.3. This listener is added after it, so
   * it never hears that first frame. One refresh, after the listener exists, puts the ring and
   * each marker on the screen at the open.
   */
  sigma.on('afterRender', drawOverlay);
  sigma.refresh();

  /**
   * **A `ResizeObserver` on the container is required, and it is not an optimisation** —
   * `CANVAS.md`. **Sigma registers no observer of its own**: it measures the container in the
   * constructor and never again. A canvas of the wrong size draws correctly and warns about
   * nothing.
   *
   * The sizes are whole numbers, so a change of less than one pixel from a flex layout or from the
   * zoom of the browser is no change here. The seed is a value that no delivery can report, so the
   * first delivery always resizes.
   */
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
      sigma.resize();
    }
  });
  sizeObserver.observe(canvas);

  /**
   * **The camera, the filter and the open panels are the workspace** — §5.4, ADR 0004 §7. Every
   * writer patches, and never replaces: two writers with two partial records each erase the
   * other's field.
   */
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

  /**
   * **A click on a node selects it, and the camera does not move** — §5.1 and UC2. There is no
   * camera call in this handler, and that absence is the rule.
   *
   * The picking layer of the library answers with a dimmed node as well, because a filter dims and
   * never hides. So the guard is here: out of consideration is out of reach.
   */
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

  /**
   * **A pointer names what it is over** — #82 A6, which the operator kept and asked to extend to a
   * relation, and #82 A10, which asks the map for the same behaviour.
   *
   * **The same filter guard as a click.** A dimmed element is out of consideration, so it is out
   * of reach: naming one would offer the analyst a thing the surface has excluded.
   *
   * **A relation is named by its type and its two ends**, because a relation has no name of its
   * own. #88 GRAPH-RELATION-DRAW owns what else a relation says on a canvas, and the direction it
   * still does not draw.
   */
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
    // **The name carries the count of relations** — #87. This canvas sizes a node by its degree,
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

  /**
   * The theme observer of `CANVAS.md`. **The paint of each element is in the model** (§4.2), and
   * only `./model` holds the rule that gives a node its colour, so the model is built again with
   * the other palette. The positions are not built again, so no node moves, and the camera and the
   * selection both hold: a node keeps its identifier across the two builds.
   */
  const themeObserver = new MutationObserver(() => {
    if (destroyed) return;
    const next = groundOf();
    if (next === ground) return;
    ground = next;
    dimCache.clear();
    model = buildGraphModel(corpus, positions, GRAPH_PALETTES[ground]);
    sigma.setGraph(model.graph);
    settle(acceptable(selection));
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  /**
   * **Each member does nothing after `destroy`** — `CANVAS.md`, the cleanup is complete. A call
   * into a killed Sigma throws, and a write to the workspace from a dead adapter is worse: the
   * record keeps that value for each later open.
   */
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
      // **A filter that excludes the selection drops the selection** — §5.1.
      settle(acceptable(selection));
    },
    setRailOpen: (open) => {
      if (destroyed) return;
      railOpen = open;
      // §5.4: every writer patches, and never replaces. A panel key is the workspace, and this
      // file is the one store of it: `graph-page.tsx` held a React copy beside it, and a value in
      // two stores is the fault ADR 0004 §7 names.
      patchGraphWorkspace({ railOpen: open });
      publish();
    },
    flyTo: (id) => {
      if (destroyed) return;
      const point = framedPointOf(id);
      if (point === null) return;
      // A control of the analyst may move the camera — §5.1. The zoom stays: what "near enough"
      // means is a camera value that nobody has decided.
      void camera.animate({ x: point.x, y: point.y });
    },
    subscribe: (listener) => {
      if (destroyed) return NO_OP;
      listeners.add(listener);
      // `CANVAS.md`: a component that subscribes after the canvas is built has already missed the
      // restore of the address. So the listener is called here with the view of this moment.
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
