/**
 * One MapLibre instance, driven directly.
 *
 * Built from `docs/map-surface.md` §4.2, §5.1, §5.2, §5.3 and §8 step 2. It also obeys ADR
 * 0004 §2 and §3, and ADR 0005 §6. This file owns the instance, the style, the sources, the
 * layers, the hit test, the camera and the disposal. It gives a handle to the other components.
 * **No other file uses the library.**
 *
 * **This file contains no React value, and it causes no render.** ADR 0004 §3. It imports no
 * React module. The mount and the cleanup are parts of `mountMap`.
 *
 * **This style has no ground layer, and no tile address.** §8 gives the two grounds, the switch,
 * the dark paint and the credit to step 4, which is `basemap`. No step needs the step after it.
 * §7 keeps the tile path of the map view open, and no ticket names it. A tile address in this
 * file is therefore a silent default, and `CLAUDE.md` gives the rule against it. The canvas stays
 * transparent. The colour of the container shows through it, and this file invents no background
 * colour.
 *
 * **The handle is the seam.** §6 leaves the `window` event of the prototype behind. So there is
 * no `CustomEvent`, and no `declare global`.
 *
 * **This file draws the relations, and it draws them under every point** — §4.7 and §8 step 8. A
 * relation never covers the thing it relates. A point wins over a line it crosses, and the one
 * `click` handler below is where that rule lives.
 *
 * **This file holds the chosen relation, and it draws no card.** §4.7 refuses the card of the
 * prototype until the operator says who owns a relation surface, and §7 holds that question open
 * with no ticket. So a click on a line brightens that line and the rail names it, and no
 * interval, no attribute and no source document is written anywhere.
 *
 * **The chosen relation dies with the view, so it lives in this closure.** The State table of the
 * skill puts such a value in React state. This surface keeps no React value below the canvas —
 * ADR 0004 §3 — so the closure of the adapter is that class here. It is not identity, so it is
 * not in the address, and it is not a setting, so it is not in the workspace.
 *
 * **This file is the only writer of `hiddenTypes` and of `linksHidden` in the workspace** — §4.4
 * and §5.2. §4.4 names four writers, and the built record carries a fifth field, `linksHidden`.
 * The document and the code differ there, the operator owns that difference, and this file
 * answers it with no second writer. It takes
 * a snapshot of that field at the mount and it writes the whole field at each switch. A second
 * writer of the same field is a fault, and this file does no merge. A stored type that the
 * corpus no longer contains stays in the list, and it goes back to storage. The corpus can gain
 * that type again, and the choice of the analyst must stay valid.
 *
 * **The route of step 5 seeds from `handle.selected`, and never from the address.** This file
 * reads the address one time. It drops a restored identifier that finds no drawn entity. It also
 * drops one that names a type which is switched off. The address can therefore name an entity
 * that the map does not mark. A route that reads the address again shows a different entity from
 * the map, and neither of the two states the difference.
 *
 * **This file owns no part of the screen.** It can show no fault to the analyst, so a fault that
 * it cannot show goes to the console. How a module under `src/` reports such a fault is an open
 * question, and the operator takes it to the tracker.
 */

import {
  AttributionControl,
  GeoJSONSource,
  Map as MapLibreMap,
  type MapMouseEvent,
  type MapMovementEvent,
  type MapOptions,
  type Subscription,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { CANVAS_LABEL_CLASS, canvasLabelTransform, relationLines } from '@/shared/canvas-label';
// PROTOTYPE — deleted with `shared/marks.prototype.ts` once the operator has chosen.
import { markOf, type MarkVocabulary } from '@/shared/marks.prototype';

import { EVERY_GROUND, GROUNDS, groundPaint } from './basemap';
import type { GeoEntity, GeoLink, Projection } from './projection';
import { patchMapWorkspace, readMapWorkspace, type Ground } from './workspace';

/**
 * `maplibre-gl` 6 exports neither `StyleSpecification` nor `LayerSpecification` again. So this
 * file takes the two shapes from the option that carries them. A copy that a person writes by
 * hand can be different from the shapes of a later version.
 */
type StyleSpec = Exclude<MapOptions['style'], string | undefined>;
type LayerSpec = StyleSpec['layers'][number];

export interface MountMapOptions {
  /**
   * The element that the library takes and owns. One element, one instance.
   *
   * **The content of this element must not decide its size.** This file observes the element, and
   * `map.resize()` writes the size of the canvas inside it. Three elements take their size from
   * that canvas. They are an `inline-block` element, a flex item with `flex-basis: auto`, and a
   * track of a grid with the size `auto`. The observer then reads the write of this file as a new
   * size, and the two make a loop. Give an element whose size the layout around it decides.
   */
  readonly container: HTMLElement;
  /**
   * The corpus, reduced to what a map can draw. `projection.ts` makes it. This file imports no
   * read module. So, on the day `src/contract/` exists, only the caller changes.
   */
  readonly projection: Projection;
  /**
   * Where the credit sits. **The corner is a parameter** — `docs/map-surface.md` §5.5. A bar that
   * floats over the map covers whichever corner it stands in, and the floating controls of the
   * prototype covered the credit twice. The rail is on the left, so the default is the corner
   * that no control of this surface reaches.
   */
  readonly creditCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** PROTOTYPE — the visual vocabulary the address asked for. See `shared/marks.prototype.ts`. */
  readonly variant?: string | undefined;
}

/**
 * What the other components of the surface use to drive the map.
 *
 * **`selected` is on the handle, so that a caller can start from it** — `docs/map-surface.md`
 * §5.1. A component that subscribes after the map is built has already missed the restore of the
 * address. So `onSelect` also calls its listener immediately, with the selection of that moment.
 * After that it calls the listener at each change.
 */
export interface MapHandle {
  /** The identity of the selected entity, or `null`. Read it to start a control. */
  readonly selected: string | null;
  /** An identifier that finds no drawn entity clears the selection. That is not a fault. */
  readonly select: (id: string | null) => void;
  /** Calls the listener immediately with the current selection. Gives the unsubscribe. */
  readonly onSelect: (listener: (id: string | null) => void) => () => void;
  readonly flyTo: (id: string) => void;
  readonly setTypeVisible: (type: string, visible: boolean) => void;
  readonly isTypeVisible: (type: string) => boolean;
  /**
   * **The relations have one switch of their own** — §4.7. They are not an entity type, and ADR
   * 0005 §6 keeps the type list a projection of the entity types and nothing else.
   */
  readonly setLinksVisible: (visible: boolean) => void;
  readonly linksVisible: boolean;
  /**
   * The relation the analyst chose with a click on a line, or `null`. **The rail names it, and
   * nothing opens a card** — §4.7 and §7.
   */
  readonly chosenLink: GeoLink | null;
  /** Calls the listener immediately with the chosen relation. Gives the unsubscribe. */
  readonly onChooseLink: (listener: (link: GeoLink | null) => void) => () => void;
  /**
   * **The ground the map draws** — §4.3. Both grounds are in the style and one is hidden, so this
   * is a layout property and never a style that is built again.
   */
  readonly setGround: (ground: Ground) => void;
  readonly ground: Ground;
  readonly destroy: () => void;
}

/** The one source of points. ADR 0005 §6: a panel of thirty types must not make thirty queries. */
const ENTITY_SOURCE = 'entities';
/** The selected point, alone. So the ring is a change of data, and never a change of style. */
const SELECTION_SOURCE = 'selection';
const SELECTION_LAYER = 'selection-ring';
const layerOfType = (type: string): string => `entity-${type}`;

/** Every relation that can be drawn. One source, and one layer over it. */
const LINK_SOURCE = 'links';
const LINK_LAYER = 'links-line';
/**
 * The relations of the selected entity, and the relation the analyst chose. The bright lines are
 * then a change of data, and never a change of style — the same shape as the ring above.
 *
 * **Two line layers, and not three.** The chosen relation needs no layer of its own: it is bright
 * for the same reason as a relation of the selection, and one source carries both. A third layer
 * would be a second answer to one question.
 */
const ACTIVE_LINK_SOURCE = 'links-active';
const ACTIVE_LINK_LAYER = 'links-active-line';

/**
 * The one colour of a line, as hex.
 *
 * **A colour must be a colour that the library reads** — §5.3. MapLibre parses the style itself,
 * so a CSS custom property never reaches it, and §9 carries the cost of that copy beside the cost
 * of the entity hues in `projection.ts`.
 *
 * **One hex reads on both grounds, because there is no ground.** Step 4 is blocked, so the canvas
 * is transparent and the colour behind a line is the page: near white in the light theme, and
 * near black in the dark theme. The white line of the prototype came from a dark basemap that
 * this step does not have. **Step 4 must read each value below again**, because a line over
 * imagery is a different question.
 *
 * **The measurements are against `--background` of `src/index.css`, in each theme.** That token is
 * `oklch(0.975 0.003 230)` in the light theme, which is `#f5f7f8`, and `oklch(0.16 0.012 215)` in
 * the dark theme, which is `#070f10`. The bright line is this hex at full opacity, and it has a
 * contrast ratio of 3.55:1 on the light page and 5.08:1 on the dark page.
 *
 * **A relation takes no entity hue.** A line is not an entity, and rule 11 gives the six hues to
 * the entity types. So the bright line is not a second colour: the quiet line is the same hue at
 * part opacity, and the bright line is the full hue and a greater width.
 */
const LINK_HUE = '#7b8489';
/**
 * The quiet line says "a relation is here". The bright line answers "what does this one touch".
 *
 * **The quiet line must stay legible on the light page.** At 0.5 this hue composites over
 * `#f5f7f8` to a contrast ratio of 1.76:1, which is close to invisible at a width of less than one
 * pixel. At 0.8 it has a ratio of 2.63:1 on the light page and 3.64:1 on the dark page, and it
 * stays clearly quieter than the 3.55:1 and 5.08:1 of the bright line. The width ramp below keeps
 * the same difference: the quiet line starts at one pixel, and the bright line is wider at each
 * zoom.
 */
// PROTOTYPE: `marks.prototype.ts` states the two now, so a variant can be judged. **These figures
// are the measurement above, and the winner has to keep them or beat them.**
const LINK_OPACITY = 0.8;
const ACTIVE_LINK_OPACITY = 1;
void LINK_OPACITY;
void ACTIVE_LINK_OPACITY;

/**
 * The hit box, in pixels on each side of the pointer — §4.7. A line of one pixel is otherwise
 * unclickable.
 *
 * **The points take the same box as the lines.** A point is a disc of three pixels at zoom 3, so a
 * bare point query gives it the narrower tolerance of the two, and a click four pixels from a
 * point centre returns the line under it. §4.7 gives that click to the point.
 */
const HIT_BOX = 5;

/** The padding of a fit, in pixels. It is six steps of the 4px grid of `src/index.css`. */
const FIT_PADDING = 24;

/**
 * The highest zoom that a fit can reach.
 *
 * A corpus of one entity, or a corpus where each entity is at one coordinate, has bounds of zero
 * width and zero height. The library then computes an infinite zoom and it clamps that value to
 * the maximum zoom of the map, which is 22. The map then shows one street. The analyst gets no
 * view of the area around the entity.
 *
 * **14 is an invented number.** §5.4 records that the first camera is a value that nobody decided,
 * and this is a parameter to calibrate. 14 is the top of the two radius ramps of this file, so a
 * point at this zoom already has its full size.
 */
const FIT_MAX_ZOOM = 14;

/**
 * The size that stands for "this file has used no size yet".
 *
 * A box of a `ResizeObserver` is never negative, so no delivery can carry this value. The seed of
 * the observer below takes it, and the first delivery therefore always resizes the canvas.
 */
const NO_SIZE = -1;

/** The unsubscribe that a destroyed handle gives. */
const NO_OP = (): void => {
  // A destroyed handle registers no listener, so it has nothing to remove.
};

/**
 * One entity, in the shape that the style parser reads. `id` is the `fid` of the projection,
 * because MapLibre needs a number for a feature identifier. The identity of the row stays `id`.
 */
interface PointFeature {
  readonly type: 'Feature';
  readonly id: number;
  readonly geometry: { readonly type: 'Point'; readonly coordinates: readonly number[] };
  readonly properties: { readonly entityType: string; readonly colour: string };
}

interface PointCollection {
  readonly type: 'FeatureCollection';
  readonly features: readonly PointFeature[];
}

const collect = (features: readonly PointFeature[]): PointCollection => ({
  type: 'FeatureCollection',
  features,
});

/**
 * One relation, as a line between its two endpoints. `id` is the `fid` of the projection, for the
 * same reason as a point: MapLibre needs a number for a feature identifier.
 *
 * **Nothing reads a property of a line.** The hit test reads `id` only, and the style filters no
 * line. So the record is empty, and it states no relation type that no layer draws.
 */
interface LineFeature {
  readonly type: 'Feature';
  readonly id: number;
  readonly geometry: {
    readonly type: 'LineString';
    readonly coordinates: readonly (readonly number[])[];
  };
  readonly properties: Readonly<Record<string, never>>;
}

interface LineCollection {
  readonly type: 'FeatureCollection';
  readonly features: readonly LineFeature[];
}

/**
 * **A relation whose endpoint is not drawn is not drawn either** — §5.1. A line that runs to a
 * point which no layer draws states a place that the map shows nowhere, which is the lie that
 * §5.1 refuses for a point. The quiet line states that place as much as the bright line does.
 *
 * The rule was written for the bright lines, and it applies to both. So both line sources, the
 * style literal and the hit test read this one function, and the four cannot drift again.
 */
const isDrawnLink = (link: GeoLink, hidden: ReadonlySet<string>): boolean =>
  !hidden.has(link.from.type) && !hidden.has(link.to.type);

const drawnLinks = (links: readonly GeoLink[], hidden: ReadonlySet<string>): readonly GeoLink[] =>
  links.filter((link) => isDrawnLink(link, hidden));

const collectLines = (links: readonly GeoLink[]): LineCollection => ({
  type: 'FeatureCollection',
  features: links.map((link) => ({
    type: 'Feature',
    id: link.fid,
    geometry: {
      type: 'LineString',
      coordinates: [
        [link.from.lon, link.from.lat],
        [link.to.lon, link.to.lat],
      ],
    },
    properties: {},
  })),
});

/**
 * What the hit test found. There are four results, and they are not two.
 *
 * `unknown` is the window before the style loads. In that window the library can answer no query.
 * A caller that reads that silence as `ground` removes a selection that the analyst kept.
 *
 * `link` is not `ground`. The analyst aimed at a relation, so the selection stays. A `link` that
 * this file read as `ground` would clear the selection under the pointer, and the brightened
 * lines would go with it.
 */
type Hit =
  | { readonly kind: 'entity'; readonly entity: GeoEntity }
  | { readonly kind: 'link'; readonly link: GeoLink }
  | { readonly kind: 'ground' }
  | { readonly kind: 'unknown' };

/**
 * Each live mount, by the element that it owns.
 *
 * **The mount does the same thing each time** — `docs/map-surface.md` §5.3. Two instances on one
 * element make the browser remove the older WebGL context. The map then looks empty, and it is
 * not empty. So a second mount destroys the first.
 *
 * React 19 StrictMode runs the effect two times in development, in this order: setup, cleanup,
 * setup. The cleanup destroys the first handle and it deletes the entry here. The second setup
 * finds no entry, and it builds a new map. React never runs a second setup before the cleanup of
 * the first.
 *
 * The first line of `mountMap` destroys an entry that it finds. That line is therefore defence
 * against a caller that mounts two times on one element with no cleanup between the two calls.
 * The `destroyed` flag stops the whole body of a second `destroy` of one handle.
 *
 * The test `mounted.get(container) === handle` in `destroy` runs at each normal unmount, and it
 * is true there. Only its false branch is not reached today. Keep it: an older handle must not
 * delete the entry of a newer handle, and the test costs one comparison.
 */
const mounted = new WeakMap<HTMLElement, MapHandle>();

export function mountMap({
  container,
  projection,
  creditCorner = 'bottom-right',
  variant,
}: MountMapOptions): MapHandle {
  mounted.get(container)?.destroy();

  // PROTOTYPE — `shared/marks.prototype.ts`. It goes with that file.
  const mark: MarkVocabulary = markOf(variant);
  /** The colour of the page, for the edge that separates two dots that touch. */
  const groundHue = (): string =>
    document.documentElement.classList.contains('dark') ? '#0b0e11' : '#ffffff';

  const stored = readMapWorkspace();
  const hidden = new Set<string>(stored.hiddenTypes);
  /**
   * **The store holds the state that is switched off** — §5.2 and `workspace.ts`. The field says
   * that the relations are hidden, and never that they are drawn, so the two switches of this
   * surface keep one polarity.
   */
  let linksHidden = stored.linksHidden;
  const colourOfType = new Map(projection.types.map((facet) => [facet.type, facet.colour]));

  /**
   * **A colour must be a colour that the library reads** — §5.3. MapLibre reads the style with
   * its own parser. So a CSS custom property never reaches it. `projection.ts` contains the hex
   * copy of the entity hues, and §9 carries the cost of that copy.
   *
   * An entity of a type that carries no facet is not drawn. This file invents no colour for it.
   * The type list is made from these same entities (ADR 0005 §6). So the case is empty today.
   */
  const featuresOf = (entities: readonly GeoEntity[]): PointFeature[] => {
    const features: PointFeature[] = [];
    for (const entity of entities) {
      const colour = colourOfType.get(entity.type);
      if (colour === undefined) continue;
      features.push({
        type: 'Feature',
        id: entity.fid,
        geometry: { type: 'Point', coordinates: [entity.lon, entity.lat] },
        properties: { entityType: entity.type, colour },
      });
    }
    return features;
  };

  const pointLayers: LayerSpec[] = projection.types.map((facet) => ({
    id: layerOfType(facet.type),
    type: 'circle',
    source: ENTITY_SOURCE,
    filter: ['==', ['get', 'entityType'], facet.type],
    // **A type is hidden with `visibility`** — ADR 0005 §6. It needs no new data. A hidden layer
    // returns nothing from `queryRenderedFeatures` after the worker parses the tile again.
    // `setLayoutProperty` only marks the source, and the new parse is asynchronous. In the window
    // between the switch and the answer of the worker, the old tile still contains the points.
    // The hit test therefore has a second guard against `hidden` — see `entityAt`.
    layout: { visibility: hidden.has(facet.type) ? 'none' : 'visible' },
    paint: {
      // PROTOTYPE: the vocabulary of `marks.prototype.ts`. The fill can be made translucent, so a
      // ring variant shows the ground through the dot, and the edge separates two that touch.
      'circle-color': facet.colour,
      'circle-opacity': mark.dot.fillOpacity,
      'circle-stroke-width': mark.dot.stroke,
      'circle-stroke-color': mark.dot.strokeFromGround ? groundHue() : facet.colour,
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        3,
        mark.dot.radius[0],
        14,
        mark.dot.radius[1],
      ],
    },
  }));

  /**
   * The two line layers, in one list, so that the order below and the hit test read one truth.
   *
   * **The width of a line follows the zoom**, like the radius of a point. A line of one width is
   * a thread at zoom 2 and a band at zoom 14. The brighter line is wider than the neutral one, so
   * the bright line is not a change of colour alone.
   */
  const linkLayers: LayerSpec[] = [
    {
      id: LINK_LAYER,
      type: 'line',
      source: LINK_SOURCE,
      // The relations are hidden with `visibility`, like a type. A hidden layer returns nothing
      // from `queryRenderedFeatures` after the worker parses the tile again, and `linkAt` guards
      // the window before that answer.
      layout: { visibility: linksHidden ? 'none' : 'visible', 'line-cap': 'round' },
      paint: {
        'line-color': LINK_HUE,
        'line-opacity': mark.line.opacity,
        // A line of less than one pixel is a grey suggestion on the light page. The ramp stays
        // under the bright ramp at each zoom of the two.
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          mark.line.width[0],
          14,
          mark.line.width[1],
        ],
      },
    },
    {
      id: ACTIVE_LINK_LAYER,
      type: 'line',
      source: ACTIVE_LINK_SOURCE,
      layout: { visibility: linksHidden ? 'none' : 'visible', 'line-cap': 'round' },
      paint: {
        'line-color': LINK_HUE,
        'line-opacity': mark.line.activeOpacity,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          2,
          mark.line.activeWidth[0],
          14,
          mark.line.activeWidth[1],
        ],
      },
    },
  ];

  /**
   * The theme, from the class on the document element — `CANVAS.md`: "The theme is read from the
   * class on `documentElement`, with an observer, and never from React."
   */
  const isDark = (): boolean => document.documentElement.classList.contains('dark');

  /** The layer that draws one ground. One ground, one layer, and one name for both. */
  const groundLayerId = (ground: Ground): string => `ground-${ground}`;

  let ground: Ground = stored.ground;

  const groundSources = Object.fromEntries(
    EVERY_GROUND.filter((name) => GROUNDS[name].tiles !== null).map((name) => {
      const source = GROUNDS[name];
      return [
        groundLayerId(name),
        {
          type: 'raster' as const,
          tiles: [source.tiles ?? ''],
          tileSize: source.tileSize,
          maxzoom: source.maxZoom,
          attribution: source.attribution,
        },
      ];
    }),
  );

  const groundLayers: LayerSpec[] = EVERY_GROUND.filter((name) => GROUNDS[name].tiles !== null).map(
    (name) => ({
      id: groundLayerId(name),
      type: 'raster',
      source: groundLayerId(name),
      // One ground is drawn and the other waits. The switch is this property and nothing else.
      layout: { visibility: name === ground ? 'visible' : 'none' },
      paint: { ...groundPaint(name, isDark()) },
    }),
  );

  const style: StyleSpec = {
    version: 8,
    sources: {
      // **Both grounds live in the style at one time, and one is hidden** — §4.3. A switch is then
      // a layout property. A style that is built again drops every source with it, and the
      // selection, the hidden types and the relations would all have to be applied a second time.
      //
      // **The credit is on the source, and MapLibre matches it to what is visible.** §5.5 records
      // that the library drops the attribution of a source that no visible layer uses, and that
      // this was checked and not assumed.
      //
      // **`maxzoom` is the ceiling of the server, and it is measured and not assumed.** §9 named
      // this as the one item to check at build time. The OSM servers answer 200 at z19 and **400
      // at z20**; the EOX service answers 200 far past its 10 m resolution, because it upsamples
      // on its own. With the ceiling stated here MapLibre never asks past it and draws the
      // overzoomed parent tile itself, so the seam is deliberate on both grounds and no request
      // reaches a third party for a tile that carries nothing new.
      ...groundSources,
      [ENTITY_SOURCE]: { type: 'geojson', data: collect(featuresOf(projection.entities)) },
      [SELECTION_SOURCE]: { type: 'geojson', data: collect([]) },
      // The store can hold a type that is already switched off, so the first frame must not draw
      // a line that runs to a point which no layer draws. The literal reads the same predicate as
      // the two paint functions below.
      [LINK_SOURCE]: { type: 'geojson', data: collectLines(drawnLinks(projection.links, hidden)) },
      [ACTIVE_LINK_SOURCE]: { type: 'geojson', data: collectLines([]) },
    },
    // The first layer of this list is at the bottom of the map, and the last layer is at the top.
    layers: [
      // **The two grounds are at the bottom, in the style literal.** The slot that stood here
      // proposed `addLayer(ground, beforeId)` at run time, with `beforeId` read from the first
      // layer of the moment. That is not needed and it is more fragile: the name of the first
      // layer follows the corpus, so it changes on the day the corpus gains a type that sorts
      // before every other one. A literal has no such name to read, and it cannot be reached
      // before the style loads. **The lines and the points stay above, in the order below.**
      ...groundLayers,
      // **The lines come before every point** — §4.7. A relation must never cover what it relates.
      ...linkLayers,
      ...pointLayers,
      {
        // **The ring is above each point layer.** One slot cannot do two jobs. A point that
        // stands near the selected point covers a ring below the points. This occurs at the low
        // zoom that the rule is about.
        id: SELECTION_LAYER,
        type: 'circle',
        source: SELECTION_SOURCE,
        paint: {
          // **The ring has no fill, and its size follows the zoom** — §5.1. A disc of one size
          // shows as a grey area at low zoom, and it covers each point that stands near it. The
          // mark then shows two points where the data has one.
          //
          // The colour of the fill is stated, and the opacity of the fill is 0. A fill colour
          // that nobody states takes the value of the parser, which is a colour that nobody
          // chose here.
          //
          // The width of the stroke follows the zoom with the radius, at the same rate. A width
          // of one value stands against a radius of two values. The weight of the ring then
          // changes by a factor of two over the range.
          // PROTOTYPE: a ring is an outline, a halo is a wide faint disc, and a double is two
          // thin rings. `marks.prototype.ts` states which.
          'circle-color': ['get', 'colour'],
          'circle-opacity': mark.selection === 'ring' ? 0 : 0.18,
          'circle-stroke-color': ['get', 'colour'],
          'circle-stroke-width':
            mark.selection === 'halo' ? 0 : ['interpolate', ['linear'], ['zoom'], 3, 1.5, 14, 3],
          'circle-radius':
            mark.selection === 'halo'
              ? ['interpolate', ['linear'], ['zoom'], 3, 14, 14, 26]
              : ['interpolate', ['linear'], ['zoom'], 3, 9, 14, 18],
        },
      },
    ],
  };

  const camera = stored.camera;
  const bounds = projection.bounds;
  const base = {
    container,
    style,
    // Step 4 owns the credit and its corner — §5.5. Nothing is credited while there is no
    // ground. The default control states a licence that no visible layer uses.
    attributionControl: false,
  } as const;
  const options: MapOptions =
    camera !== null
      ? { ...base, center: [camera.lon, camera.lat], zoom: camera.zoom }
      : bounds !== null
        ? {
            ...base,
            bounds: [bounds[0], bounds[1], bounds[2], bounds[3]],
            fitBoundsOptions: { padding: FIT_PADDING, maxZoom: FIT_MAX_ZOOM },
          }
        : // Nothing can be drawn. So the map shows the world, which states no place that the data
          // does not contain. §5.4 records that the first camera is a value that nobody decided.
          { ...base, center: [0, 0], zoom: 0 };

  const map = new MapLibreMap(options);

  /**
   * **The credit is drawn, and its corner is a parameter** — §5.5. The default control of the
   * library was switched off while there was no ground, because it stated a licence that no
   * visible layer used. There is a ground now, so the control is added, and MapLibre reads the
   * attribution of each source that a **visible** layer uses. The hidden ground therefore credits
   * nothing, which is the rule §5.5 states.
   *
   * It is not compact. A credit behind a control that a reader must open is an obligation of a
   * licence that the screen does not meet.
   */
  map.addControl(new AttributionControl({ compact: false }), creditCorner);

  let destroyed = false;
  let styleReady = false;
  const queued: (() => void)[] = [];
  const subscriptions: Subscription[] = [];

  /**
   * **A layout property needs a loaded style** — §5.3. `setLayoutProperty` throws an error while
   * the style loads, and the analyst can click a control in that window. `getSource` returns
   * nothing in the same window, and it reports no fault for that — §5.1.
   *
   * One queue covers both cases, for each caller. A later caller therefore has one pattern to copy.
   */
  const whenStyleReady = (work: () => void): void => {
    if (destroyed) return;
    if (styleReady) work();
    else queued.push(work);
  };

  /**
   * The queue runs each task, and one task that throws an error stops no other task.
   *
   * The list is emptied into a local list first, and the caller sets `styleReady` to `true` before
   * it calls this function. A task that asks for more work therefore runs that work immediately,
   * and it reaches neither the queue nor this loop. Each task runs in its own `try`. An error goes
   * to the console here, because this file owns no part of the screen. An error that leaves this
   * function goes into the event dispatcher of the library, which stops the rest of the load.
   */
  const drain = (): void => {
    const tasks = queued.splice(0);
    for (const work of tasks) {
      try {
        work();
      } catch (error) {
        console.error('The map could not run a task that waited for the style.', error);
      }
    }
  };

  const selectListeners = new Set<(id: string | null) => void>();

  /**
   * **The restore is one way, and it occurs one time** — §5.1. This file reads the address here,
   * at the mount, and never again. It never writes the address. The route owns the navigation and
   * `replace: true`.
   */
  const wanted = new URLSearchParams(window.location.search).get('entity');
  const restored = wanted === null ? null : (projection.byId.get(wanted) ?? null);
  // An old identifier gives no selection, and it shows no fault on the screen. The map draws no
  // selected point of a type that is switched off. A mark on such a point shows a point that the
  // map does not draw. Such a selection is dropped as well — §5.1.
  let selected: string | null = restored === null || hidden.has(restored.type) ? null : restored.id;

  /**
   * The relation the analyst chose with a click on a line, or `null`. **It starts at `null` on
   * every open**, because it dies with the view and no store carries it.
   */
  let chosenLink: GeoLink | null = null;
  const chooseLinkListeners = new Set<(link: GeoLink | null) => void>();

  const paintSelection = (): void => {
    whenStyleReady(() => {
      const source = map.getSource(SELECTION_SOURCE);
      // The test on the class gives the type that declares `setData`. The queue above already made
      // the source available, so this test is a narrowing and not a second guard.
      if (!(source instanceof GeoJSONSource)) return;
      const entity = selected === null ? undefined : projection.byId.get(selected);
      // `setData` returns a promise, and `void` drops it. The data is here already, so the
      // promise carries no fetch that can fail. A rejection can only come from a map that the
      // analyst closed while the parser worked, and that is not a fault to report.
      void source.setData(collect(featuresOf(entity === undefined ? [] : [entity])));
    });
  };

  /**
   * The quiet lines, which say "a relation is here".
   *
   * **A relation whose endpoint is not drawn is not quiet either** — see `isDrawnLink`. The rule
   * was written for the bright lines, and it applies to both. So each change of the visibility of
   * a type paints this source again, with the same queue and the same guard as the bright lines.
   */
  const paintBaseLinks = (): void => {
    whenStyleReady(() => {
      const source = map.getSource(LINK_SOURCE);
      // The test on the class gives the type that declares `setData`, exactly as above.
      if (!(source instanceof GeoJSONSource)) return;
      void source.setData(collectLines(drawnLinks(projection.links, hidden)));
    });
  };

  /**
   * **The bright lines follow the selection, and they need no click** — §4.7. They answer "what
   * does this one touch". A selection that the address restored is painted through the same queue,
   * so the lines and the ring arrive together once the style loads — §5.1.
   *
   * A type that switches off drops the selection, and this source is emptied with it.
   *
   * **A relation whose endpoint is not drawn is not bright.** A line at full opacity that runs to
   * a point which no layer draws states a place that the map shows nowhere, which is the lie that
   * §5.1 refuses for a point. Each change of the visibility of a type therefore calls this
   * function again.
   */
  const paintActiveLinks = (): void => {
    whenStyleReady(() => {
      const source = map.getSource(ACTIVE_LINK_SOURCE);
      if (!(source instanceof GeoJSONSource)) return;
      const mine = selected === null ? [] : (projection.linksByEntity.get(selected) ?? []);
      // The chosen relation joins the bright set. It can touch no selected entity, and it is
      // then the one bright line. `mine` can hold it already, and a repeated feature identifier
      // is a fault of the source, so the test keeps one copy.
      const bright =
        chosenLink === null || mine.includes(chosenLink) ? mine : [...mine, chosenLink];
      void source.setData(collectLines(drawnLinks(bright, hidden)));
    });
  };

  /**
   * **The chosen relation dies with the view** — see the head of this file. A click on a line
   * brightens that line, the rail names it, and nothing here opens a card.
   */
  const setChosenLink = (next: GeoLink | null): void => {
    if (destroyed || next === chosenLink) return;
    chosenLink = next;
    paintActiveLinks();
    // Each listener reads the value of this call, for the reason `setSelected` states below.
    for (const listener of chooseLinkListeners) listener(next);
  };

  // The selection that comes from the address is drawn at the load, through the same queue.
  paintSelection();
  paintActiveLinks();

  const setSelected = (next: string | null): void => {
    if (destroyed || next === selected) return;
    selected = next;
    // **A new selection ends the choice of a relation.** The bright set then answers one
    // question, which is "what does this one touch". One paint draws both changes.
    const droppedLink = chosenLink;
    chosenLink = null;
    paintSelection();
    paintActiveLinks();
    if (droppedLink !== null) for (const listener of chooseLinkListeners) listener(null);
    // Each listener reads the value of this call, and never the live variable. A listener can
    // call `select` again, and that call changes the variable in the middle of the loop. The
    // listeners after it would then read a value that depends on their place in the set.
    for (const listener of selectListeners) listener(next);
  };

  /** The identifiers of the point layers, taken from the layers themselves. One list, one truth. */
  const pointLayerIds = pointLayers.map((layer) => layer.id);

  /** The same rule for the lines. Both line layers are clickable, and the brighter one too. */
  const linkLayerIds = linkLayers.map((layer) => layer.id);

  /**
   * The hit test asks the library. It reads `id` only, which contains the `fid` of the projection.
   * `properties` of a feature that comes back has no type, so nothing here reads it.
   *
   * **`fid` is a position in an array, and it is not an identity.** `projection.ts` counts it
   * after `filter(hasGeometry)`. It is therefore valid against the one `Projection` that made it,
   * and against no other. The identity of the row is `id`.
   *
   * **A point of a type that is switched off gives the result `ground`.** `setLayoutProperty` only
   * marks the source, and the worker parses the tile again after that. Until the worker answers,
   * the old tile still contains the points of the hidden layer, and the query returns them. A
   * hit in that window would select a point that the map draws nowhere, which §5.1 forbids, and
   * `handle.select` would refuse the same identifier. The guard on `hidden` makes the two agree.
   *
   * **A point wins over a line it crosses** — §4.7. The point is the smaller target, and it is the
   * one the analyst aimed at. So the points are asked first, and the lines only where no point
   * answered. There is one `click` handler, and this order lives inside it — §5.3.
   */
  const hitAt = (point: MapMouseEvent['point']): Hit => {
    if (!styleReady) return { kind: 'unknown' };
    // **One box, for the points and for the lines** — see `HIT_BOX`. A point that is asked with a
    // bare point loses a click that the line beside it takes, at each zoom where the disc is
    // narrower than the box.
    const box: [[number, number], [number, number]] = [
      [point.x - HIT_BOX, point.y - HIT_BOX],
      [point.x + HIT_BOX, point.y + HIT_BOX],
    ];
    for (const feature of map.queryRenderedFeatures(box, { layers: pointLayerIds })) {
      const fid = feature.id;
      if (typeof fid !== 'number') continue;
      const entity = projection.byFid.get(fid);
      if (entity !== undefined && !hidden.has(entity.type)) return { kind: 'entity', entity };
    }
    // **A relation that is switched off gives the result `ground`.** It is the same window as the
    // guard above: the layer is marked hidden, and the old tile still answers until the worker
    // parses it again. The two paths therefore hold one rule.
    if (linksHidden) return { kind: 'ground' };
    // **A line needs a hit box of about five pixels on each side** — §4.7. A line of one pixel is
    // otherwise unclickable. The box above is that box, and the points already used it.
    for (const feature of map.queryRenderedFeatures(box, { layers: linkLayerIds })) {
      const fid = feature.id;
      if (typeof fid !== 'number') continue;
      const link = projection.byLinkFid.get(fid);
      // **A relation whose endpoint is not drawn gives the result `ground`.** It is the same
      // window as the guard on the points: the source is marked, and the old tile still answers
      // until the worker parses it again. A hit in that window would name a relation that runs to
      // a point the map draws nowhere. The rule was written for the bright lines, and the rail
      // and the map hold it together here.
      if (link !== undefined && isDrawnLink(link, hidden)) return { kind: 'link', link };
    }
    return { kind: 'ground' };
  };

  subscriptions.push(
    map.on('load', () => {
      styleReady = true;
      drain();
    }),
  );

  /**
   * True when the camera is the choice of the analyst. The adapter must then not frame the corpus
   * over that camera.
   *
   * Six places write it. They are the `click` that changes the selection, the `movestart` of a
   * gesture, the `moveend` of a gesture, `boxzoomstart`, `boxzoomend` and `handle.flyTo`. The two
   * events of a gesture both write it. The start arms the flag against a drag that a resize
   * kills, and the end arms it for a move that begins with no `originalEvent`.
   *
   * `workspace.ts` keeps `camera` at `null` until a camera is stored, so that the
   * first open frames the corpus. A camera that this file stores for a move that the analyst did
   * not make removes that first frame from each later open. The frame of a container of the wrong
   * size then stays.
   *
   * **A caller that sets the first camera through `handle.flyTo` at the mount stops each job of
   * the observer below.** Those two jobs repair the canvas and the frame of a container of the
   * wrong size. Such a caller needs a different way to set that camera.
   */
  let cameraIsAnalystChoice = false;

  /**
   * The name a pointer draws over this canvas — #81 row A10.
   *
   * **The operator asked for the hover name of the graph, here.** They liked that design and asked
   * the two canvases to read as one product. `shared/canvas-label.ts` states how it looks, and the
   * graph reads the same recipe: the two libraries share no draw call, so one file of words and
   * one geometry rule is what can be shared.
   *
   * **It is a child of the container and not of the canvas.** MapLibre owns the canvas element and
   * replaces it on a context loss, so an element inside it would go with it.
   *
   * **It names a relation as well as a point**, in the same words the graph uses.
   */
  const hoverLabel = document.createElement('div');
  hoverLabel.className = CANVAS_LABEL_CLASS;
  hoverLabel.hidden = true;
  container.append(hoverLabel);

  /** What the label says now, so that a move over one feature writes the DOM one time. */
  let hoverWords: string | null = null;

  const nameHover = (
    lines: readonly string[] | null,
    point: { x: number; y: number } | null,
  ): void => {
    if (lines === null || point === null) {
      hoverWords = null;
      hoverLabel.hidden = true;
      return;
    }
    const words = lines.join('|');
    if (words !== hoverWords) {
      hoverWords = words;
      // One element per line, so each one truncates on its own — a relation takes three.
      hoverLabel.replaceChildren(
        ...lines.map((line) => {
          const row = document.createElement('span');
          row.textContent = line;
          return row;
        }),
      );
      hoverLabel.hidden = false;
    }
    // The label follows the pointer here, and the graph anchors it to the node. A map has no
    // node radius to stand clear of, and a point under the pointer is the thing being named.
    hoverLabel.style.transform = canvasLabelTransform(point.x, point.y);
  };

  /**
   * **The pointer names what it is over, and it changes no state** — #81 A10.
   *
   * It asks the same question as the click, through the one hit test, so the thing that is named
   * and the thing that a click takes can never disagree. A type that is switched off is hidden on
   * this surface, and `hitAt` already refuses it.
   */
  subscriptions.push(
    map.on('mousemove', (event) => {
      const hit = hitAt(event.point);
      if (hit.kind === 'entity') {
        nameHover([hit.entity.label], event.point);
        return;
      }
      if (hit.kind === 'link') {
        nameHover(
          relationLines(hit.link.from.label, hit.link.type, hit.link.to.label),
          event.point,
        );
        return;
      }
      nameHover(null, null);
    }),
  );

  // A pointer that leaves the canvas names nothing. Without this the label stays where the
  // pointer left the map.
  subscriptions.push(
    map.on('mouseout', () => {
      nameHover(null, null);
    }),
  );

  // **One `click` handler, and it asks what is under the pointer** — §5.3. Two handlers make the
  // result depend on the order in which they run.
  subscriptions.push(
    map.on('click', (event) => {
      const hit = hitAt(event.point);
      // The style is not loaded, so the library can say nothing about this point. A click in
      // that window changes no selection. The selection from the address stays.
      if (hit.kind === 'unknown') return;
      // **A click on a line chooses that relation, and it opens nothing** — §4.7 and §7. The card
      // of the prototype waits for the operator to say who owns a relation surface. The line is
      // brightened and the rail names it. The selection stays: a line that cleared it would take
      // away the bright lines of the entity under the pointer.
      if (hit.kind === 'link') {
        setChosenLink(hit.link);
        return;
      }
      // A click on a point or on the ground ends the choice. `setSelected` does the same, and it
      // does nothing where the selection does not change — a click on the ground with no
      // selection, for one.
      setChosenLink(null);
      const next = hit.kind === 'entity' ? hit.entity.id : null;
      // **A click that changes the selection is an act of the analyst**, so it arms the flag. The
      // sidebar of the route is a flex sibling of the map, so a selection changes the width of the
      // container. Without this line the observer below frames the corpus again, and it throws
      // away the frame that the analyst reads.
      if (next !== selected) cameraIsAnalystChoice = true;
      setSelected(next);
    }),
  );

  /**
   * **The adapter is one of the four writers of the workspace, and each writer patches** — §4.4.
   * A writer that knows one part of the record only removes the field of the other writer.
   */
  const storeCamera = (): void => {
    if (destroyed) return;
    const centre = map.getCenter();
    patchMapWorkspace({ camera: { lon: centre.lng, lat: centre.lat, zoom: map.getZoom() } });
  };

  /**
   * **A `moveend` of a gesture carries `originalEvent`, and a `moveend` of the program carries
   * none.** `MapMovementEvent` declares `originalEvent` as `MouseEvent | TouchEvent | WheelEvent |
   * undefined`. The handler manager of the library fires each move event of a pointer, a wheel or
   * a key with the DOM event of that gesture. It gives the same DOM event to the movement that
   * continues after the analyst releases a drag. `jumpTo`, `easeTo`, `flyTo` and `fitBounds` fire
   * with the data that the caller gives, which is nothing here.
   *
   * This test also keeps `resize` out. `Map.resize` fires `moveend`, and the observer of the
   * library calls it with the entries of that observer, which carry no `originalEvent`. Without
   * this test, this file would write `localStorage` on the main thread too often. It would write
   * at each change of the size of the window, at each open of the rail and at each fit.
   */
  subscriptions.push(
    map.on('moveend', (event: MapMovementEvent) => {
      if (event.originalEvent === undefined) return;
      cameraIsAnalystChoice = true;
      storeCamera();
    }),
  );

  /**
   * **A gesture arms the flag at its first frame, and not at its end.** `map.resize()` calls
   * `stop()` while `Camera._moving` is false. A drag never sets that field, because the library
   * sets it in `_prepareEase` and in `_afterEase` only. `stop()` resets each handler, and the
   * handler manager fires no `moveend` for the drag that it kills. So the gesture that arms the
   * flag on `moveend` is the gesture that a resize destroys, and the flag can never arm. A
   * `movestart` with `originalEvent` arms it at the first frame, and each later delivery of the
   * observer below then does nothing.
   *
   * This handler stores no camera. The camera at the start of a move is the camera from before it.
   */
  subscriptions.push(
    map.on('movestart', (event: MapMovementEvent) => {
      if (event.originalEvent === undefined) return;
      cameraIsAnalystChoice = true;
    }),
  );

  /**
   * The `moveend` listeners of the camera animations that the rail started and that are not
   * complete.
   *
   * A move that the program starts carries no `originalEvent`, so the handler above stores
   * nothing for it. The act of the rail, `flyTo`, is an act of the analyst, and it stores its
   * camera at its own call site, here. `destroy` removes each listener that is still waiting.
   */
  const pendingMoveEnds = new Set<() => void>();

  /**
   * Stores the camera at the end of the camera animation that the caller has just started.
   *
   * The library begins an animation with `stop()`. `stop()` fires the `moveend` of an animation
   * that is not complete. That event reaches the listener of the earlier animation, which stores
   * the camera at the point where the map stopped. That value is correct, because the map was at
   * that camera. This listener is added after the call, so the earlier event does not reach it.
   *
   * An animation that ends inside the call stores its camera at once. `flyTo` becomes a jump when
   * the setting for reduced motion of the operating system is on. A fit that the library refuses
   * to compute moves nothing. In both cases no later `moveend` comes, and a listener would then
   * wait for the move of a different caller.
   */
  const storeCameraAfterMove = (): void => {
    if (!map.isMoving()) {
      storeCamera();
      return;
    }
    const listener = (): void => {
      pendingMoveEnds.delete(listener);
      storeCamera();
    };
    pendingMoveEnds.add(listener);
    map.once('moveend', listener);
  };

  /**
   * **A box zoom arms the flag at its start.** This gesture changes no camera until it ends, so
   * `movestart` cannot reach it. `BoxZoomHandler` only draws a `<div>` while the analyst drags.
   * A size delivery in that window calls `map.resize()`, which stops and resets each handler.
   * The box then goes away under the pointer. `boxzoomend` never fires, and the fit never runs.
   */
  subscriptions.push(
    map.on('boxzoomstart', () => {
      cameraIsAnalystChoice = true;
    }),
  );

  /** The `idle` listeners of a box zoom whose fit is not complete. `destroy` removes each one. */
  const pendingIdles = new Set<() => void>();

  /**
   * **Box zoom is the one gesture with no `originalEvent`.** `BoxZoomHandler.mouseupWindow` ends
   * the gesture with a call of `fitScreenCoordinates`, and that call gives no event data. The
   * `moveend` of that fit therefore looks like a move of the program. Box zoom is on by default,
   * and this file switches it off nowhere. So this one gesture needs its own listener.
   *
   * The library fires `boxzoomend` before it starts the fit. The camera at this moment is
   * therefore the camera from before the gesture, and the store must wait. It waits for `idle`,
   * which the map fires after the fit ends and after the next render. `moveend` is not safe here.
   * Before the fit starts, the library stops an animation that is not complete. That stop fires
   * the `moveend` of the earlier animation.
   */
  subscriptions.push(
    map.on('boxzoomend', () => {
      cameraIsAnalystChoice = true;
      const listener = (): void => {
        pendingIdles.delete(listener);
        storeCamera();
      };
      pendingIdles.add(listener);
      map.once('idle', listener);
    }),
  );

  /**
   * Frames the whole corpus with no animation. The observer below is the one caller, and this
   * function stores no camera. That caller calls `map.resize()` before it, so the transform of the
   * map holds the new size of the container already.
   *
   * **`duration: 0` makes the frame immediate.** `fitBounds` with no `duration` and no `linear`
   * becomes a call of `flyTo`, which is a curved animation. Each delivery of the observer starts
   * that animation again. The map then moves for the whole time that the container changes size,
   * and the analyst sees that movement.
   *
   * `duration: 0` does not avoid `stop()`. `flyTo` calls `stop()` before it reads `duration`.
   * Under reduced motion the library uses `jumpTo`, which also starts with `stop()`.
   */
  const correctCorpusFrame = (): void => {
    if (bounds === null) return;
    map.fitBounds([bounds[0], bounds[1], bounds[2], bounds[3]], {
      padding: FIT_PADDING,
      maxZoom: FIT_MAX_ZOOM,
      duration: 0,
    });
  };

  /**
   * **A `ResizeObserver` on the container is necessary, and it is not an improvement of speed** —
   * §5.3. MapLibre measures the container one time, in the constructor, while the browser still
   * builds the chrome around it. The prototype measured a canvas of 1140 by 97 inside a container
   * of 1140 by 839, and nothing gave a warning. A map draws correctly in a canvas of the wrong
   * size.
   *
   * **The observer of the library does not cover that measurement.** It drops its first delivery
   * always. A container can become stable between the constructor and that delivery. It then
   * sends its true size in the delivery that the library drops, and no second delivery comes. The
   * canvas then keeps the measurement of the constructor. This is the recorded fault, and it
   * survives on the path that most opens take.
   *
   * **This observer does two jobs, and the first job runs at each open.**
   * 1. A size that is different from the size that this file used last calls `map.resize()`. This
   *    is the job that covers the delivery which the library drops. A returning analyst, an empty
   *    corpus and each open after the first gesture get this job.
   * 2. Only while the open found no stored camera and the analyst chose no camera, the same
   *    delivery also frames the corpus again.
   *
   * **After the analyst chooses a camera, this observer does nothing, and it calls no
   * `map.resize()`.** The observer of the library owns each delivery after the first one, and the
   * first one is long past at that moment.
   *
   * **This file calls `map.resize()` before the fit.** The observer of the library is throttled at
   * 50ms. That throttle fires on the leading edge, and it fires again on the trailing edge. So the
   * library can apply the last size of the container up to 50ms after this callback. The fit would
   * then read a transform of an earlier size, and no later call frames the corpus again.
   *
   * **This observer compares sizes, and it counts no deliveries.** A `ResizeObserver` reports only
   * a box that is different from the box it reported before, and its first recorded box is (0,0).
   * A container that has `display: none` at the mount gives no delivery at `observe()`. The first
   * delivery then carries the real size. A rule that drops the first delivery drops that size, and
   * the map keeps the frame of the measurement of the constructor.
   *
   * **The sizes are whole numbers.** `entry.contentRect` gives the content box with a fraction,
   * and this file rounds each value. A change of less than one pixel, from a flex layout or from
   * the zoom of the browser, is then no change here. The library sees no change there either.
   *
   * **The seed of the last used size is a value that no delivery can report.** The first delivery
   * therefore always resizes. The two boxes are not the same box. MapLibre measures with
   * `clientWidth` and `clientHeight`, which give the padding box. The observer reports the content
   * box. A seed that measures the container can equal a later delivery, and the canvas would then
   * keep the measurement of the constructor.
   *
   * **The container can become stable over three deliveries or more.** A flex layout gets its size
   * over several frames, and a rail changes the width for the whole time that it opens. A
   * correction that runs one time frames the corpus against an intermediate size, and it never
   * repairs that frame.
   */
  const framesCorpusOnOpen = camera === null && bounds !== null;
  let usedWidth = NO_SIZE;
  let usedHeight = NO_SIZE;
  const observer = new ResizeObserver((entries) => {
    if (destroyed || cameraIsAnalystChoice) return;
    for (const entry of entries) {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width === usedWidth && height === usedHeight) continue;
      usedWidth = width;
      usedHeight = height;
      map.resize();
      if (framesCorpusOnOpen) correctCorpusFrame();
    }
  });
  observer.observe(container);

  /**
   * **Each member of the handle does nothing after `destroy`** — `CANVAS.md`, the cleanup is
   * complete. After `map.remove()` the style of the map is absent, and a call of
   * `setLayoutProperty` throws an error. A write to the workspace from a dead adapter is worse,
   * because the record keeps that value for each later open. A guard in `destroy` alone does not
   * reach either fault.
   */
  /**
   * Paints every ground for the theme in force. **The inversion reaches the ground layer only**,
   * so no entity hue and no relation line moves with the theme — §4.3.
   *
   * It runs through the queue, because `setPaintProperty` needs a loaded style exactly as
   * `setLayoutProperty` does.
   */
  const paintGrounds = (): void => {
    whenStyleReady(() => {
      const dark = isDark();
      for (const name of EVERY_GROUND) {
        if (GROUNDS[name].tiles === null) continue;
        const paint = groundPaint(name, dark);
        const id = groundLayerId(name);
        // The three keys are written one at a time, and each one is a literal, because the paint
        // setter of the library takes a key of its own union and never a plain string.
        map.setPaintProperty(id, 'raster-brightness-min', paint['raster-brightness-min']);
        map.setPaintProperty(id, 'raster-brightness-max', paint['raster-brightness-max']);
        map.setPaintProperty(id, 'raster-hue-rotate', paint['raster-hue-rotate']);
      }
    });
  };

  /**
   * **The theme is read from the class on `documentElement`, with an observer, and never from
   * React** — `CANVAS.md`. A React value here would sit in the tree that wraps the live element,
   * which is the fault ADR 0004 names.
   *
   * The observer watches one attribute of one element, so it delivers only on a theme change.
   */
  const themeObserver = new MutationObserver(paintGrounds);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  const handle: MapHandle = {
    get selected() {
      return destroyed ? null : selected;
    },
    select: (id) => {
      if (destroyed) return;
      const entity = id === null ? undefined : projection.byId.get(id);
      setSelected(entity === undefined || hidden.has(entity.type) ? null : entity.id);
    },
    onSelect: (listener) => {
      if (destroyed) return NO_OP;
      selectListeners.add(listener);
      // **A component that subscribes after the map is built has already missed the restore** —
      // §5.1. The listener is called here with the current selection. So no caller must
      // remember to read `selected` first.
      listener(selected);
      return () => selectListeners.delete(listener);
    },
    flyTo: (id) => {
      if (destroyed) return;
      const entity = projection.byId.get(id);
      // **The camera refuses what `select` refuses.** An entity of a type that is switched off is
      // drawn nowhere, so a flight to it takes the analyst to an empty place and the selection
      // that the same act asked for is dropped by `select`. The two members hold one rule.
      if (entity === undefined || hidden.has(entity.type)) return;
      // The rail calls this, so the analyst made this move. This line arms the flag before the
      // camera call, so the observer interrupts this animation with no correction of the size.
      cameraIsAnalystChoice = true;
      // The zoom of the analyst stays. What "near enough" means is a camera value, and §5.4
      // records that nobody has decided one.
      map.flyTo({ center: [entity.lon, entity.lat] });
      // The animation carries no gesture of its own, so it stores its camera here.
      storeCameraAfterMove();
    },
    setTypeVisible: (type, visible) => {
      if (destroyed) return;
      // A type with no layer has no switch. `setLayoutProperty` throws an error on a layer that
      // is absent.
      if (!colourOfType.has(type)) return;
      if (visible) hidden.delete(type);
      else hidden.add(type);
      patchMapWorkspace({ hiddenTypes: [...hidden] });
      whenStyleReady(() => {
        map.setLayoutProperty(layerOfType(type), 'visibility', visible ? 'visible' : 'none');
      });
      // **A type that is switched off drops the selection** — §5.1. The map draws no point for
      // that type, so a mark on such a point shows a point that is not there.
      const entity = selected === null ? undefined : projection.byId.get(selected);
      if (!visible && entity?.type === type) setSelected(null);
      // **A relation whose endpoint is not drawn must not stay on the map.** The line then names a
      // point that the map shows nowhere, which is the lie that §5.1 refuses for a point. The
      // rule covers the quiet lines, the chosen relation and every relation of the selection, so
      // both sets are painted again at each change of this switch, and never at the switch off
      // alone: a type that comes back brings its lines back with it.
      if (!visible && (chosenLink?.from.type === type || chosenLink?.to.type === type)) {
        setChosenLink(null);
      }
      paintBaseLinks();
      paintActiveLinks();
    },
    // A destroyed handle draws no type.
    isTypeVisible: (type) => !destroyed && !hidden.has(type),
    /**
     * **The relations have one switch, and it is not in the type list** — §4.7. ADR 0005 §6 keeps
     * that list a projection of the entity types. This file is the only writer of `linksHidden`,
     * and the rail calls this member and patches nothing itself.
     *
     * The switch drops no selection. A relation is not an entity, so a hidden line leaves no
     * marked point undrawn, and §5.1 asks for nothing here.
     */
    setLinksVisible: (visible) => {
      if (destroyed) return;
      linksHidden = !visible;
      patchMapWorkspace({ linksHidden });
      whenStyleReady(() => {
        for (const id of linkLayerIds) {
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }
      });
      // A switch that hides each line ends the choice. The rail must name no relation that the
      // map draws nowhere.
      if (!visible) setChosenLink(null);
    },
    // A destroyed handle draws no relation.
    get linksVisible() {
      return !destroyed && !linksHidden;
    },
    // A destroyed handle holds no choice.
    get chosenLink() {
      return destroyed ? null : chosenLink;
    },
    onChooseLink: (listener) => {
      if (destroyed) return NO_OP;
      chooseLinkListeners.add(listener);
      // The same rule as `onSelect`: a caller that subscribes late has missed nothing.
      listener(chosenLink);
      return () => chooseLinkListeners.delete(listener);
    },
    /**
     * **The switch is a layout property, and never a style that is built again** — §4.3. Both
     * grounds are in the style, so this shows one and hides the other, and every source, the
     * selection and the filter survive it.
     *
     * The credit follows on its own: MapLibre reads the attribution of each source that a visible
     * layer uses, and it drops the one that no visible layer uses — §5.5.
     */
    setGround: (next) => {
      if (destroyed) return;
      if (GROUNDS[next].tiles === null) return;
      ground = next;
      patchMapWorkspace({ ground: next });
      whenStyleReady(() => {
        for (const name of EVERY_GROUND) {
          if (GROUNDS[name].tiles === null) continue;
          map.setLayoutProperty(
            groundLayerId(name),
            'visibility',
            name === next ? 'visible' : 'none',
          );
        }
      });
    },
    get ground() {
      return ground;
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      themeObserver.disconnect();
      observer.disconnect();
      for (const subscription of subscriptions) subscription.unsubscribe();
      // A camera animation of the rail that is not complete has a listener that waits for one
      // `moveend`. `map.remove()` alone leaves it registered on a dead map.
      for (const listener of pendingMoveEnds) map.off('moveend', listener);
      pendingMoveEnds.clear();
      // The same rule applies to a box zoom whose fit is not complete.
      for (const listener of pendingIdles) map.off('idle', listener);
      pendingIdles.clear();
      selectListeners.clear();
      chooseLinkListeners.clear();
      // A task that waits for a style which never loads stays in the closure. The list is emptied.
      queued.length = 0;
      // The hover label is a child of the container and not of the canvas, so `map.remove()` does
      // not take it: this file appended it, and this file removes it.
      hoverLabel.remove();
      if (mounted.get(container) === handle) mounted.delete(container);
      map.remove();
    },
  };

  mounted.set(container, handle);
  return handle;
}
