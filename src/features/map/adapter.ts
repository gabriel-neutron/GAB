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

import { arrowImage } from '@/shared/canvas-arrow';
import {
  CANVAS_LABEL_CLASS,
  canvasLabelTransform,
  entityLines,
  relationLines,
} from '@/shared/canvas-label';

import { EVERY_GROUND, GROUNDS, groundPaint } from './basemap';
import type { GeoEntity, GeoLink, Projection } from './projection';
import { patchMapWorkspace, readMapWorkspace, type Ground } from './workspace';

// `maplibre-gl` 6 exports neither `StyleSpecification` nor `LayerSpecification`. So this file
// takes the two shapes from the option that carries them.
type StyleSpec = Exclude<MapOptions['style'], string | undefined>;
type LayerSpec = StyleSpec['layers'][number];

export interface MountMapOptions {
  // The content of this element must not decide its size. This file writes the canvas size with
  // `map.resize()`, and a container that sizes to its canvas makes a loop with the observer.
  readonly container: HTMLElement;
  readonly projection: Projection;
  readonly creditCorner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

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
  readonly setLinksVisible: (visible: boolean) => void;
  readonly linksVisible: boolean;
  readonly chosenLink: GeoLink | null;
  /** Calls the listener immediately with the chosen relation. Gives the unsubscribe. */
  readonly onChooseLink: (listener: (link: GeoLink | null) => void) => () => void;
  readonly setGround: (ground: Ground) => void;
  readonly ground: Ground;
  readonly destroy: () => void;
}

/** The one source of points. A panel of thirty types must not make thirty queries. */
const ENTITY_SOURCE = 'entities';
/** The selected point, alone. So the ring is a change of data, and never a change of style. */
const SELECTION_SOURCE = 'selection';
const SELECTION_LAYER = 'selection-ring';
const layerOfType = (type: string): string => `entity-${type}`;

/** Every relation that can be drawn. One source, and one layer over it. */
const LINK_SOURCE = 'links';
const LINK_LAYER = 'links-line';
const ACTIVE_LINK_SOURCE = 'links-active';
const ACTIVE_LINK_LAYER = 'links-active-line';

// MapLibre places a symbol along a line from the start of that line, and no expression reads
// where a line ends or which way it runs. So the end point and the bearing are computed here,
// and the layer turns the image by that bearing.
const ARROW_SOURCE = 'link-arrows';
const ARROW_LAYER = 'link-arrow';
const ARROW_IMAGE = 'link-arrow-head';

// MapLibre parses the style itself, so a CSS custom property never reaches it and the colour must
// be a hex. Measured against `--background` of `src/index.css`, `#f5f7f8` light and `#070f10`
// dark, this hue at full opacity gives a ratio of 3.55:1 on light and 5.08:1 on dark.
const LINK_HUE = '#7b8489';

// The edge that keeps a point clear of the imagery under it. It is black on every ground, and not
// a theme token: `--foreground` is near white in the dark theme and would read as a second mark.
// A CSS custom property never reaches the style parser of MapLibre, so the hex is stated here.
const POINT_OUTLINE = '#000000';
// At 0.5 this hue over `#f5f7f8` gives a contrast ratio of 1.76:1, which is close to invisible.
// At 0.8 it gives 2.63:1 on the light page and 3.64:1 on the dark page, and it stays quieter than
// the 3.55:1 and 5.08:1 of the bright line.
const LINK_OPACITY = 0.8;
const ACTIVE_LINK_OPACITY = 1;

// The hit box, in pixels on each side of the pointer. A line of one pixel is otherwise
// unclickable. A point is a disc of 3px at zoom 3, so a bare point query gives the narrower
// tolerance and a click 4px from the centre returns the line under it. Points take this box too.
const HIT_BOX = 5;

/** The padding of a fit, in pixels. It is six steps of the 4px grid of `src/index.css`. */
const FIT_PADDING = 24;

// The highest zoom a fit can reach. Bounds of zero width give an infinite zoom that the library
// clamps to 22, which shows one street. 14 is an invented number, and it is the top of the two
// radius ramps of this file, so a point at this zoom already has its full size.
const FIT_MAX_ZOOM = 14;

// A `ResizeObserver` box is never negative, so no delivery can carry this value. The seed of the
// observer below takes it, and the first delivery therefore always resizes the canvas.
const NO_SIZE = -1;

/** The unsubscribe that a destroyed handle gives. */
const NO_OP = (): void => {
  // A destroyed handle registers no listener, so it has nothing to remove.
};

// `id` is the `fid` of the projection, because MapLibre needs a number for a feature identifier.
// The identity of the row stays `id`.
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

// `id` is the `fid` of the projection, because MapLibre needs a number for a feature identifier.
// Nothing reads a property of a line, so the record is empty.
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

// A line that runs to a point which no layer draws states a place the map shows nowhere.
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

// The bearing is the plane angle, and not the great-circle one. The great-circle bearing is the
// angle a vessel would steer, and not the angle of the straight line this map draws. At a high
// latitude the two differ by degrees, and the head would then point off its own line.
interface ArrowFeature {
  readonly type: 'Feature';
  readonly id: number;
  readonly geometry: {
    readonly type: 'Point';
    readonly coordinates: readonly [number, number];
  };
  readonly properties: { readonly bearing: number };
}

interface ArrowCollection {
  readonly type: 'FeatureCollection';
  readonly features: readonly ArrowFeature[];
}

const collectArrows = (links: readonly GeoLink[]): ArrowCollection => ({
  type: 'FeatureCollection',
  features: links.map((link) => ({
    type: 'Feature',
    id: link.fid,
    geometry: { type: 'Point', coordinates: [link.to.lon, link.to.lat] },
    properties: {
      bearing:
        (Math.atan2(link.to.lon - link.from.lon, link.to.lat - link.from.lat) * 180) / Math.PI,
    },
  })),
});

// `unknown` is the window before the style loads, where the library can answer no query. A caller
// that reads that silence as `ground` removes a selection the analyst kept. `link` is not `ground`
// either: the analyst aimed at a relation, so the selection stays.
type Hit =
  | { readonly kind: 'entity'; readonly entity: GeoEntity }
  | { readonly kind: 'link'; readonly link: GeoLink }
  | { readonly kind: 'ground' }
  | { readonly kind: 'unknown' };

// Two instances on one element make the browser remove the older WebGL context, and the map then
// looks empty without being empty. So a second mount destroys the first. React 19 StrictMode runs
// setup, cleanup, setup, and never a second setup before the cleanup of the first.
const mounted = new WeakMap<HTMLElement, MapHandle>();

export function mountMap({
  container,
  projection,
  creditCorner = 'bottom-right',
}: MountMapOptions): MapHandle {
  mounted.get(container)?.destroy();

  const stored = readMapWorkspace();
  const hidden = new Set<string>(stored.hiddenTypes);
  // The store holds the state that is switched off, so `linksHidden` says the relations are
  // hidden and never that they are drawn. The two switches of this surface keep one polarity.
  let linksHidden = stored.linksHidden;
  const colourOfType = new Map(projection.types.map((facet) => [facet.type, facet.colour]));

  // MapLibre reads the style with its own parser, so a CSS custom property never reaches it and
  // `projection.ts` holds the hex copy. An entity of a type with no facet is drawn nowhere.
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
    // `setLayoutProperty` only marks the source, and the new parse is asynchronous. In the window
    // between the switch and the answer of the worker, the old tile still holds the points and
    // `queryRenderedFeatures` returns them. So the hit test has a second guard against `hidden`.
    layout: { visibility: hidden.has(facet.type) ? 'none' : 'visible' },
    paint: {
      'circle-color': facet.colour,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 14, 7],
      // **The outline is on every point, and no state removes it** — see `POINT_OUTLINE`.
      'circle-stroke-color': POINT_OUTLINE,
      // The width follows the zoom with the radius, so the outline stays a hairline and never a
      // second disc. At zoom 3 the point is 3px and the outline 1px; at zoom 14, 7px and 1.6px.
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 14, 1.6],
    },
  }));

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
        'line-opacity': LINK_OPACITY,
        // A line of less than one pixel is a grey suggestion on the light page. The ramp starts
        // at one pixel, and it stays under the bright ramp at each zoom of the two.
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1, 8, 1.4, 14, 2.2],
      },
    },
    {
      id: ACTIVE_LINK_LAYER,
      type: 'line',
      source: ACTIVE_LINK_SOURCE,
      layout: { visibility: linksHidden ? 'none' : 'visible', 'line-cap': 'round' },
      paint: {
        'line-color': LINK_HUE,
        'line-opacity': ACTIVE_LINK_OPACITY,
        'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.4, 8, 2.4, 14, 3.5],
      },
    },
  ];

  // The heads are above the lines and below every point: a relation must never cover the thing it
  // relates. The collision machinery is off, because MapLibre drops a symbol that meets another
  // one, and a dropped head reads as a relation with no direction.
  const arrowLayer: LayerSpec = {
    id: ARROW_LAYER,
    type: 'symbol',
    source: ARROW_SOURCE,
    layout: {
      visibility: linksHidden ? 'none' : 'visible',
      'icon-image': ARROW_IMAGE,
      // The head follows the zoom with the width of the line it belongs to, at the same rate.
      'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.22, 8, 0.34, 14, 0.48],
      // The image points north, so the bearing on the feature is the whole of the rotation.
      'icon-rotate': ['get', 'bearing'],
      'icon-rotation-alignment': 'map',
      // The head stands back from the point it names, along its own axis: a mark on the centre
      // covers the thing it marks. The step is in the units of the image, so it follows
      // `icon-size` and never the length of the relation.
      'icon-offset': [0, 14],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-opacity': LINK_OPACITY },
  };

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
      // `maxzoom` is the ceiling of the server, and it is measured. The OSM servers answer 200 at
      // z19 and 400 at z20; the EOX service answers 200 far past its 10 m resolution, because it
      // upsamples. MapLibre then asks no tile past the ceiling and overzooms the parent itself.
      ...groundSources,
      [ENTITY_SOURCE]: { type: 'geojson', data: collect(featuresOf(projection.entities)) },
      [SELECTION_SOURCE]: { type: 'geojson', data: collect([]) },
      // The store can hold a type that is already switched off, so the first frame must not draw
      // a line that runs to a point which no layer draws. The literal reads the same predicate as
      // the two paint functions below.
      [LINK_SOURCE]: { type: 'geojson', data: collectLines(drawnLinks(projection.links, hidden)) },
      [ACTIVE_LINK_SOURCE]: { type: 'geojson', data: collectLines([]) },
      // The heads read the same list as the quiet lines, so a type that switches off takes its
      // heads with its lines and no second truth about what is drawn can appear.
      [ARROW_SOURCE]: {
        type: 'geojson',
        data: collectArrows(drawnLinks(projection.links, hidden)),
      },
    },
    // The first layer of this list is at the bottom of the map, and the last layer is at the top.
    layers: [
      ...groundLayers,
      // **The lines come before every point.** A relation must never cover what it relates.
      ...linkLayers,
      arrowLayer,
      ...pointLayers,
      {
        // **The ring is above each point layer.** One slot cannot do two jobs. A point that
        // stands near the selected point covers a ring below the points. This occurs at the low
        // zoom that the rule is about.
        id: SELECTION_LAYER,
        type: 'circle',
        source: SELECTION_SOURCE,
        paint: {
          // The ring has no fill, and its size follows the zoom. A disc of one size reads as a
          // grey area at low zoom, and it covers each point near it. The fill colour is stated,
          // because a colour that nobody states takes the value of the parser.
          'circle-color': ['get', 'colour'],
          'circle-opacity': 0,
          'circle-stroke-color': ['get', 'colour'],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 14, 3],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 9, 14, 18],
        },
      },
    ],
  };

  const camera = stored.camera;
  const bounds = projection.bounds;
  const base = {
    container,
    style,
    // The control is added below, with its corner, so the default one is switched off here.
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
          // does not contain.
          { ...base, center: [0, 0], zoom: 0 };

  const map = new MapLibreMap(options);

  // MapLibre credits each source that a visible layer uses, so the hidden ground credits nothing.
  // It is not compact: a credit behind a control that a reader must open does not meet a licence.
  map.addControl(new AttributionControl({ compact: false }), creditCorner);

  let destroyed = false;
  let styleReady = false;
  const queued: (() => void)[] = [];
  const subscriptions: Subscription[] = [];

  // `setLayoutProperty` throws while the style loads, and `getSource` returns nothing in the same
  // window with no fault reported. The analyst can click a control there, so one queue covers both.
  const whenStyleReady = (work: () => void): void => {
    if (destroyed) return;
    if (styleReady) work();
    else queued.push(work);
  };

  // Each task runs in its own `try`. An error that leaves this function goes into the event
  // dispatcher of MapLibre, which stops the rest of the load. The list is emptied into a local
  // list first, so a task that asks for more work runs it at once and never re-enters this loop.
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

  // This file reads the address here, at the mount, and never again. It never writes the address:
  // the route owns the navigation.
  const address = new URLSearchParams(window.location.search);
  // An empty value is not an identifier. The router writes `entity=` for the empty selection,
  // which is the normal state of a map.
  const wanted = address.get('entity') === '' ? null : address.get('entity');
  const restored = wanted === null ? null : (projection.byId.get(wanted) ?? null);
  // An old identifier gives no selection, and it shows no fault on the screen. The map draws no
  // selected point of a type that is switched off. A mark on such a point shows a point that the
  // map does not draw. Such a selection is dropped as well.
  let selected: string | null = restored === null || hidden.has(restored.type) ? null : restored.id;

  // The chosen relation is dropped under the same rules as a selected point: a panel that names a
  // relation which this canvas draws nowhere is a lie on the screen. The route then corrects the
  // address, because `onChooseLink` announces what this file accepted.
  const wantedLink = address.get('relation') === '' ? null : address.get('relation');
  const restoredLink =
    wantedLink === null ? null : (projection.links.find((link) => link.id === wantedLink) ?? null);
  let chosenLink: GeoLink | null =
    restoredLink !== null && !linksHidden && isDrawnLink(restoredLink, hidden)
      ? restoredLink
      : null;
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

  const paintBaseLinks = (): void => {
    whenStyleReady(() => {
      const source = map.getSource(LINK_SOURCE);
      // The test on the class gives the type that declares `setData`, exactly as above.
      if (!(source instanceof GeoJSONSource)) return;
      const drawn = drawnLinks(projection.links, hidden);
      void source.setData(collectLines(drawn));
      // The heads follow the same list, in the same queue, so a line and its head can never
      // disagree about which relations are drawn.
      const heads = map.getSource(ARROW_SOURCE);
      if (heads instanceof GeoJSONSource) void heads.setData(collectArrows(drawn));
    });
  };

  // A relation whose endpoint is not drawn is not bright either. A line at full opacity that runs
  // to a point which no layer draws states a place the map shows nowhere. So each change of the
  // visibility of a type calls this function again.
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

  // `fid` is a position in an array and not an identity: it is valid against the one `Projection`
  // that made it. A point of a hidden type gives `ground`, because the old tile still answers
  // until the worker parses it again. Points are asked first, so a point wins over a line.
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
    // **A line needs a hit box of about five pixels on each side.** A line of one pixel is
    // otherwise unclickable. The box above is that box, and the points already used it.
    for (const feature of map.queryRenderedFeatures(box, { layers: linkLayerIds })) {
      const fid = feature.id;
      if (typeof fid !== 'number') continue;
      const link = projection.byLinkFid.get(fid);
      // A relation whose endpoint is not drawn gives the result `ground`. It is the same window
      // as the guard on the points: the source is marked, and the old tile still answers until
      // the worker parses it again.
      if (link !== undefined && isDrawnLink(link, hidden)) return { kind: 'link', link };
    }
    return { kind: 'ground' };
  };

  // This style holds no sprite and no glyph server, so the image the style names must come from
  // here. `styleimagemissing` is not the path in `maplibre-gl` 6: it fires, and the layer that was
  // built keeps an empty image. That was measured in the browser and not assumed.
  map.setMissingStyleImageResolver((id) => {
    if (id !== ARROW_IMAGE || map.hasImage(id)) return;
    map.addImage(id, arrowImage(LINK_HUE));
  });

  subscriptions.push(
    map.on('load', () => {
      styleReady = true;
      drain();
    }),
  );

  // True when the camera is the choice of the analyst, so the adapter must not frame the corpus
  // over it. `workspace.ts` keeps `camera` at `null` until a camera is stored, so a camera stored
  // for a move that the analyst did not make would remove the first frame from each later open.
  let cameraIsAnalystChoice = false;

  // The label is a child of the container and not of the canvas. MapLibre owns the canvas element
  // and replaces it on a context loss, so an element inside it would go with it.
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

  subscriptions.push(
    map.on('mousemove', (event) => {
      const hit = hitAt(event.point);
      if (hit.kind === 'entity') {
        // **The name carries the count of relations, in the words the graph uses.** This canvas
        // draws every point at one radius, so the count is not a second reading of the picture
        // here: it is the one place the map states it at all.
        nameHover(
          entityLines(hit.entity.label, (projection.linksByEntity.get(hit.entity.id) ?? []).length),
          event.point,
        );
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

  // **One `click` handler, and it asks what is under the pointer.** Two handlers make the result
  // depend on the order in which they run.
  subscriptions.push(
    map.on('click', (event) => {
      const hit = hitAt(event.point);
      // The style is not loaded, so the library can say nothing about this point. A click in
      // that window changes no selection. The selection from the address stays.
      if (hit.kind === 'unknown') return;
      // The selection stays. A line that cleared it would take away the bright lines of the
      // entity under the pointer.
      if (hit.kind === 'link') {
        setChosenLink(hit.link);
        return;
      }
      // A click on a point or on the ground ends the choice. `setSelected` does the same, and it
      // does nothing where the selection does not change — a click on the ground with no
      // selection, for one.
      setChosenLink(null);
      const next = hit.kind === 'entity' ? hit.entity.id : null;
      // A selection changes the width of the container, because the sidebar of the route is a
      // flex sibling of the map. Without this flag the observer below frames the corpus again,
      // and it throws away the frame that the analyst reads.
      if (next !== selected) cameraIsAnalystChoice = true;
      setSelected(next);
    }),
  );

  // Each writer of the workspace patches. A writer that knows one part of the record only would
  // remove the field of another writer.
  const storeCamera = (): void => {
    if (destroyed) return;
    const centre = map.getCenter();
    patchMapWorkspace({ camera: { lon: centre.lng, lat: centre.lat, zoom: map.getZoom() } });
  };

  // A `moveend` of a gesture carries `originalEvent`, and a `moveend` of the program carries none.
  // `jumpTo`, `easeTo`, `flyTo` and `fitBounds` fire with the data of the caller, which is nothing
  // here. This also keeps `resize` out: `Map.resize` fires `moveend` from the observer of MapLibre.
  subscriptions.push(
    map.on('moveend', (event: MapMovementEvent) => {
      if (event.originalEvent === undefined) return;
      cameraIsAnalystChoice = true;
      storeCamera();
    }),
  );

  // A gesture arms the flag at its first frame, and not at its end. `map.resize()` calls `stop()`
  // while `Camera._moving` is false, a drag never sets that field, and the handler manager fires
  // no `moveend` for the drag that it kills. A flag armed on `moveend` could therefore never arm.
  subscriptions.push(
    map.on('movestart', (event: MapMovementEvent) => {
      if (event.originalEvent === undefined) return;
      cameraIsAnalystChoice = true;
    }),
  );

  // A move that the program starts carries no `originalEvent`, so the handler above stores nothing
  // for it. `flyTo` from the rail stores its camera at its own call site. `destroy` removes each
  // listener that is still waiting.
  const pendingMoveEnds = new Set<() => void>();

  // The library begins an animation with `stop()`, which fires the `moveend` of an animation that
  // is not complete. This listener is added after the call, so that event does not reach it. An
  // animation that ends inside the call stores at once: `flyTo` jumps under reduced motion.
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

  // A box zoom arms the flag at its start. The gesture changes no camera until it ends, so
  // `movestart` cannot reach it. `BoxZoomHandler` only draws a `<div>` while the analyst drags,
  // and a `map.resize()` in that window resets each handler, so `boxzoomend` never fires.
  subscriptions.push(
    map.on('boxzoomstart', () => {
      cameraIsAnalystChoice = true;
    }),
  );

  /** The `idle` listeners of a box zoom whose fit is not complete. `destroy` removes each one. */
  const pendingIdles = new Set<() => void>();

  // Box zoom is the one gesture with no `originalEvent`: `BoxZoomHandler.mouseupWindow` ends it
  // with `fitScreenCoordinates`, which gives no event data. The library fires `boxzoomend` before
  // the fit, so the store waits for `idle`. `moveend` is not safe: the fit stops an earlier ease.
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

  // `duration: 0` makes the frame immediate. `fitBounds` with no `duration` and no `linear`
  // becomes a `flyTo`, which is a curved animation that each delivery of the observer starts
  // again. It does not avoid `stop()`: `flyTo` calls `stop()` before it reads `duration`.
  const correctCorpusFrame = (): void => {
    if (bounds === null) return;
    map.fitBounds([bounds[0], bounds[1], bounds[2], bounds[3]], {
      padding: FIT_PADDING,
      maxZoom: FIT_MAX_ZOOM,
      duration: 0,
    });
  };

  // MapLibre measures the container one time, in the constructor, and the observer of the library
  // drops its first delivery. A container that becomes stable between the two keeps the canvas of
  // the constructor. `map.resize()` runs before the fit, because that observer is throttled 50ms.
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

  // Every ground is painted for the theme in force, and the inversion reaches the ground layer
  // only. It runs through the queue, because `setPaintProperty` needs a loaded style.
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

  // The theme is read from the class on `documentElement` and never from React. A React value here
  // would sit in the tree that wraps the live element. The filter delivers on a theme change only.
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
      // **A component that subscribes after the map is built has already missed the restore.**
      // The listener is called here with the current selection. So no caller must remember to
      // read `selected` first.
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
      // The centre moves and the zoom of the analyst stays.
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
      // **A type that is switched off drops the selection.** The map draws no point for that
      // type, so a mark on such a point shows a point that is not there.
      const entity = selected === null ? undefined : projection.byId.get(selected);
      if (!visible && entity?.type === type) setSelected(null);
      // A relation whose endpoint is not drawn must not stay on the map. Both sets are painted
      // again at each change of this switch, and never at the switch off alone: a type that comes
      // back brings its lines back with it.
      if (!visible && (chosenLink?.from.type === type || chosenLink?.to.type === type)) {
        setChosenLink(null);
      }
      paintBaseLinks();
      paintActiveLinks();
    },
    // A destroyed handle draws no type.
    isTypeVisible: (type) => !destroyed && !hidden.has(type),
    // The switch drops no selection. A relation is not an entity, so a hidden line leaves no
    // marked point undrawn.
    setLinksVisible: (visible) => {
      if (destroyed) return;
      linksHidden = !visible;
      patchMapWorkspace({ linksHidden });
      whenStyleReady(() => {
        // The heads go with the lines. They are not in `linkLayerIds`, because that list is the
        // hit test as well: a click must find the line, and a head has no identity of its own.
        for (const id of [...linkLayerIds, ARROW_LAYER]) {
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
    // Both grounds are in the style, so this shows one and hides the other, and every source, the
    // selection and the filter survive it. MapLibre then drops the credit of the hidden ground.
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
