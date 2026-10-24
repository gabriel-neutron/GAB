import { canvasTheme, observeCanvasTheme } from '@/shared/canvas-theme';
// The one file that touches the map library. The panels drive the globe through the store, and
// this file is the view of the store that draws on the canvas.

import { PRODUCTS } from '@gab/proposal/chain-product';
import { positions } from '@gab/proposal/geometry-positions';
import countriesUrl from '@gab/proposal/countries.json?url';
import {
  Map as MapLibre,
  Marker,
  type ExpressionSpecification,
  type FilterSpecification,
  ScaleControl,
  type LineLayerSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { GlobeData } from './globe-data';
import type { GlobeState, GlobeStore, Target } from './globe-store';
import { selectedEntity } from './selected-entity';
import { ARC_LAYERS, type ArcLayer } from './arc-layers';
import {
  createChainAnimation,
  drawLayers,
  flowLayer,
  flowLayers,
  revealed,
} from './chain-animation';
import { frameOf, highlightOf, pickHit, type Under } from './globe-view';

// MapLibre takes hex colours rather than CSS theme tokens.
const MAP_PALETTES = {
  light: {
    ground: '#f5f7f8',
    land: '#e0e5e7',
    coast: '#a0aaaf',
    selected: '#20282d',
    link: '#6f797e',
    sky: '#f5f7f8',
    horizon: '#e0e5e7',
  },
  dark: {
    ground: '#070f10',
    land: '#182226',
    coast: '#445155',
    selected: '#f0f3f4',
    link: '#76838a',
    sky: '#070f10',
    horizon: '#182226',
  },
} as const;
const LAND = MAP_PALETTES.dark.land;
const MARK = '#4aa8ff';
const IN_REVIEW = '#9aa3ad';
// Origin of the number: at this opacity a dimmed point stays visible on the dark land, and a
// point put forward reads at once.
const DIMMED = 0.35;
// Ceiling of the rule on state changes: a dim, a camera jump and a hover each take less.
const CHANGE_MS = 100;
// The hit box of a line, in pixels on each side of the click.
const LINE_BOX = 5;
// Origin of the number: at zoom 4 the globe shows about 20 degrees, so the coast is in view also
// around one point.
const ENTITY_ZOOM = 4;
const SPIN_STEP = 6;
const SPIN_MS = 2000;

const ARC_COLOURS: Readonly<Record<ArcLayer['colour'], string | ExpressionSpecification>> = {
  product: ['coalesce', ['get', 'colour'], MARK],
  review: IN_REVIEW,
  land: LAND,
};

// A point wins over an exit ring, a ring over a line or an area, and each of them over an arc.
const GROUPS: readonly (readonly string[])[] = [
  ['points'],
  ['exits'],
  ['lines', 'areas'],
  ARC_LAYERS.map((one) => one.id),
];
const ARC_IDS: ReadonlySet<string> = new Set(ARC_LAYERS.map((one) => one.id));

const forward = (ids: ReadonlySet<string> | null): ExpressionSpecification | number =>
  ids === null ? 1 : ['case', ['in', ['get', 'id'], ['literal', [...ids]]], 1, DIMMED];

// External constraint: the library draws with WebGL 2 only.
const hasWebGL2 = (): boolean => document.createElement('canvas').getContext('webgl2') !== null;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const targetKind = (layer: string): Target['kind'] =>
  layer === 'exits' ? 'exit' : ARC_IDS.has(layer) ? 'arc' : 'entity';

interface MountOptions {
  // The content of this element must not decide its size: the observer below writes the canvas
  // size, and a container that sizes to its canvas makes a loop with it.
  readonly container: HTMLElement;
  readonly data: GlobeData;
  readonly store: GlobeStore;
  /** True for the flat map, which is the default. False for the globe of the animated mode. */
  readonly flat: boolean;
}

export interface GlobeHandle {
  readonly destroy: () => void;
}

// A second mount on the same element finds the first and ends it. React runs an effect twice in
// development, and a second WebGL context makes the browser drop the older one.
const mounted = new WeakMap<HTMLElement, GlobeHandle>();

/** Draws the globe in `container` and follows the store. Gives null when the browser cannot draw
 * it, and the store then says so. */
export function mountGlobe({ container, data, store, flat }: MountOptions): GlobeHandle | null {
  mounted.get(container)?.destroy();
  if (!hasWebGL2()) {
    store.setUnavailable();
    return null;
  }

  const palette = MAP_PALETTES[canvasTheme()];
  const style: StyleSpecification = {
    version: 8,
    projection: { type: flat ? 'mercator' : 'globe' },
    // A change of paint is a state change and not a fade of 300 ms, which is the default.
    transition: { duration: store.get().moving ? CHANGE_MS : 0, delay: 0 },
    sky: {
      'sky-color': palette.sky,
      'horizon-color': palette.horizon,
      'fog-color': palette.ground,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    },
    // The basemap is a file of the bundle: the outlines of the countries, Natural Earth (public
    // domain, so it asks for no credit and the map shows none). The globe sends no request to a tile server.
    sources: {
      countries: { type: 'geojson', data: countriesUrl },
      // The animation sets a feature state by identifier.
      entities: { type: 'geojson', data: data.entities, promoteId: 'id' },
      // The flow reads the progress along each line.
      arcs: { type: 'geojson', data: data.arcs, lineMetrics: true, promoteId: 'id' },
      exits: { type: 'geojson', data: data.exits, promoteId: 'id' },
    },
    layers: [
      { id: 'ground', type: 'background', paint: { 'background-color': palette.ground } },
      { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': palette.land } },
      {
        id: 'coast',
        type: 'line',
        source: 'countries',
        paint: { 'line-color': palette.coast, 'line-width': 0.6 },
      },
      {
        id: 'areas',
        type: 'fill',
        source: 'entities',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': ['coalesce', ['get', 'colour'], MARK],
          'fill-opacity': 0.3,
          'fill-outline-color': ['coalesce', ['get', 'colour'], MARK],
        },
      },
      {
        id: 'selected-line',
        type: 'line',
        source: 'entities',
        filter: ['==', ['get', 'id'], ''],
        paint: { 'line-color': palette.selected, 'line-width': 6, 'line-opacity': 0.5 },
      },
      {
        id: 'lines',
        type: 'line',
        source: 'entities',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': ['coalesce', ['get', 'colour'], MARK], 'line-width': 2 },
      },
      ...ARC_LAYERS.map((one): LineLayerSpecification => ({
        id: one.id,
        type: 'line',
        source: 'arcs',
        filter: ['==', ['get', 'style'], one.style],
        layout: { 'line-cap': one.dash === null ? 'round' : 'butt' },
        paint: {
          'line-color': ARC_COLOURS[one.colour],
          'line-width': typeof one.width === 'number' ? one.width : ['get', one.width],
          'line-opacity': one.opacity,
          ...(one.dash === null ? {} : { 'line-dasharray': one.dash }),
        },
      })),
      // A draw-on and a flow run along the links of a step. A gradient reads no property of the
      // feature, so each product has its own layer. A link in review is not a fact, and a capacity
      // is not a flow, so neither carries a flow.
      ...drawLayers(),
      ...flowLayers('none'),
      {
        id: 'points',
        type: 'circle',
        source: 'entities',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': ['coalesce', ['get', 'colour'], MARK],
          'circle-radius': revealed(6),
          'circle-stroke-color': palette.ground,
          'circle-stroke-width': 1.5,
        },
      },
      {
        id: 'selected-point',
        type: 'circle',
        source: 'entities',
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'circle-opacity': 0,
          'circle-radius': 10,
          'circle-stroke-color': palette.selected,
          'circle-stroke-width': 2,
        },
      },
      {
        id: 'exits',
        type: 'circle',
        source: 'exits',
        paint: {
          // A ring with no fill, so the asset under an exit point stays in view.
          'circle-opacity': 0,
          'circle-radius': revealed(10),
          'circle-stroke-color': ['case', ['get', 'inReview'], IN_REVIEW, ['get', 'colour']],
          'circle-stroke-width': 2.5,
        },
      },
    ],
  };

  let map: MapLibre;
  try {
    map = new MapLibre({ container, style, center: [0, 30], zoom: 1, attributionControl: false });
  } catch {
    store.setUnavailable();
    return null;
  }

  let destroyed = false;
  let loaded = false;
  // A paint or layout property needs a loaded style. One queue, drained on load, serves every
  // caller.
  const queue: (() => void)[] = [];
  const whenLoaded = (work: () => void): void => {
    if (loaded) work();
    else queue.push(work);
  };

  // Departure: with every product shown, a link is one neutral grey, so the hue of a point is the
  // one colour on the map. A product chip gives the links of that product their colour.
  const paintLinks = (product: GlobeState['product']): void => {
    const colour = product === 'all' ? MAP_PALETTES[canvasTheme()].link : ARC_COLOURS.product;
    for (const layer of ARC_LAYERS)
      if (layer.colour === 'product') map.setPaintProperty(layer.id, 'line-color', colour);
  };

  const paintTheme = (): void => {
    const next = MAP_PALETTES[canvasTheme()];
    paintLinks(store.get().product);
    map.setPaintProperty('ground', 'background-color', next.ground);
    map.setPaintProperty('land', 'fill-color', next.land);
    map.setPaintProperty('coast', 'line-color', next.coast);
    map.setPaintProperty('points', 'circle-stroke-color', next.ground);
    for (const layer of ARC_LAYERS)
      if (layer.colour === 'land') map.setPaintProperty(layer.id, 'line-color', next.land);
    map.setPaintProperty('selected-line', 'line-color', next.selected);
    map.setPaintProperty('selected-point', 'circle-stroke-color', next.selected);
    map.setSky({
      'sky-color': next.sky,
      'horizon-color': next.horizon,
      'fog-color': next.ground,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    });
  };
  const stopTheme = observeCanvasTheme(() => whenLoaded(paintTheme));

  map.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

  // The library measures the container once, while the chrome around it is still being built.
  const observer = new ResizeObserver(() => {
    if (!destroyed) map.resize();
  });
  observer.observe(container);

  const frame = frameOf(
    data.places,
    data.entities.features.map((one) => one.id),
  );
  if (frame !== null) map.fitBounds(frame, { padding: 60, maxZoom: 4, duration: 0 });

  // A label on the globe is a marker built from text nodes, because the basemap has no font file
  // and a label comes from the release.
  const label = (words: string, at: unknown): Marker | null => {
    const [where] = positions(at);
    if (where === undefined) return null;
    const element = document.createElement('span');
    element.textContent = words;
    element.className =
      'pointer-events-none border border-border bg-background px-1 text-small/4 text-foreground';
    return new Marker({ element, anchor: 'top', offset: [0, 8] }).setLngLat([...where]);
  };
  // Each link in review carries the words "in review" at the middle of its line, so the globe
  // never shows it as a fact.
  const reviewLabels = data.arcs.features.flatMap((one) => {
    if (one.properties.style !== 'in review') return [];
    const path = positions(one.geometry.coordinates);
    const marker = label('in review', path[Math.floor(path.length / 2)]);
    return marker === null ? [] : [{ product: one.properties.product, marker }];
  });
  const exportLabels = data.entities.features.flatMap((one) => {
    if (one.properties['stageKey'] !== 'export') return [];
    const marker = label(text(one.properties['label']), one.geometry.coordinates);
    return marker === null ? [] : [marker];
  });

  const centreOn = (id: string): void => {
    const [at] = data.places.get(id) ?? [];
    if (at === undefined) return;
    map.easeTo({
      center: [...at],
      zoom: Math.max(map.getZoom(), ENTITY_ZOOM),
      duration: store.get().moving ? CHANGE_MS : 0,
    });
  };

  const draw = (state: GlobeState): void => {
    const entity = selectedEntity(state);
    const highlight = highlightOf(data, {
      entity,
      stage: state.stage,
      step: state.step,
      product: state.product,
    });
    const assets = forward(highlight?.assets ?? null);
    map.setPaintProperty('points', 'circle-opacity', revealed(assets));
    map.setPaintProperty('points', 'circle-stroke-opacity', revealed(assets));
    map.setPaintProperty('lines', 'line-opacity', revealed(assets));
    map.setPaintProperty('areas', 'fill-opacity', revealed(0.3, assets));
    map.setPaintProperty(
      'exits',
      'circle-stroke-opacity',
      revealed(forward(highlight?.exits ?? null)),
    );
    const selection: FilterSpecification = ['==', ['get', 'id'], entity ?? ''];
    map.setFilter('selected-point', ['all', ['==', ['geometry-type'], 'Point'], selection]);
    map.setFilter('selected-line', ['all', ['!=', ['geometry-type'], 'Point'], selection]);
    const arcFilter: FilterSpecification =
      state.product === 'all' ? ['boolean', true] : ['==', ['get', 'product'], state.product];
    const arcs = forward(highlight?.arcs ?? null);
    paintLinks(state.product);
    for (const one of ARC_LAYERS) {
      map.setFilter(one.id, ['all', ['==', ['get', 'style'], one.style], arcFilter]);
      map.setPaintProperty(one.id, 'line-opacity', revealed(one.opacity, arcs));
    }
    for (const one of PRODUCTS) {
      map.setLayoutProperty(
        flowLayer(one.key),
        'visibility',
        state.moving && (state.product === 'all' || state.product === one.key) ? 'visible' : 'none',
      );
      map.setPaintProperty(flowLayer(one.key), 'line-opacity', revealed(arcs));
    }
    for (const one of reviewLabels)
      if (state.product === 'all' || one.product === state.product) one.marker.addTo(map);
      else one.marker.remove();
    for (const marker of exportLabels)
      if (state.step === 'terminal' && entity === null) marker.addTo(map);
      else marker.remove();
  };

  // The globe turns slowly until the reader acts. Each turn starts when the one before it ends.
  let spinning = store.get().moving;
  const spin = (): void => {
    if (!spinning || destroyed || !store.get().moving) return;
    const centre = map.getCenter();
    map.easeTo({
      center: [centre.lng - SPIN_STEP, centre.lat],
      duration: SPIN_MS,
      easing: (t) => t,
    });
  };
  const stopSpin = (): void => {
    spinning = false;
  };
  map.on('moveend', spin);
  // A drag, a touch, a wheel turn or a key on the globe is the reader's act.
  for (const event of ['mousedown', 'touchstart', 'wheel', 'dragstart'] as const)
    map.on(event, () => {
      stopSpin();
      store.stopPlay();
    });
  const onKey = (): void => {
    stopSpin();
    store.stopPlay();
  };
  container.addEventListener('keydown', onKey);

  // The system can ask for no motion while the page is open.
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onReduced = (): void => {
    if (!reduced.matches) return;
    stopSpin();
    store.stopMotion();
  };
  reduced.addEventListener('change', onReduced);

  const animation = createChainAnimation(map, data);

  // What the previous state looked like, so a change moves the camera once.
  let seen: GlobeState = store.get();
  // A click on the globe selects what the reader sees, so the camera stays where it is.
  let selectedByClick = false;
  const follow = (): void => {
    const state = store.get();
    const before = seen;
    seen = state;
    if (
      !state.moving ||
      state.panel !== before.panel ||
      state.step !== before.step ||
      state.product !== before.product
    )
      stopSpin();
    whenLoaded(() => {
      if (destroyed) return;
      draw(state);
      if (state.step !== before.step || state.moving !== before.moving)
        animation.show(state.step, {
          moving: state.moving,
          camera: state.step !== null || selectedEntity(state) === null,
        });
      animation.flow(state.moving);
      const entity = selectedEntity(state);
      if (entity !== null && entity !== selectedEntity(before) && !selectedByClick)
        centreOn(entity);
    });
  };

  map.on('load', () => {
    loaded = true;
    paintTheme();
    for (const work of queue.splice(0)) work();
    // Seed from the state of this moment, then follow it: a selection restored from the address is
    // drawn here, and the subscription below missed nothing.
    const state = store.get();
    seen = state;
    draw(state);
    const entity = selectedEntity(state);
    if (entity !== null) {
      stopSpin();
      centreOn(entity);
    } else if (state.step !== null) {
      stopSpin();
      animation.show(state.step, { moving: state.moving, camera: true });
    } else spin();
    animation.flow(state.moving);
  });
  const unsubscribe = store.subscribe(follow);

  const choiceLabel = (id: string, layer: string): string => {
    if (layer === 'exits') return data.exitInfo[id]?.label ?? id;
    if (ARC_IDS.has(layer)) return data.arcInfo[id]?.label ?? id;
    return data.cards[id]?.label ?? id;
  };

  map.on('click', (event) => {
    const { x, y } = event.point;
    const near = (box: number): ReturnType<typeof map.queryRenderedFeatures> =>
      map.queryRenderedFeatures(
        [
          [x - box, y - box],
          [x + box, y + box],
        ],
        { layers: GROUPS.flat() },
      );
    // A line needs a wider hit box than a point, and a point wins over a line it crosses.
    const hits: Under[] = near(LINE_BOX).map((one) => ({
      layer: one.layer.id,
      id: text(one.properties['id']),
    }));
    const picked = pickHit(hits, GROUPS);
    selectedByClick = true;
    if (picked.kind === 'one')
      store.select({ kind: targetKind(picked.hit.layer), id: picked.hit.id });
    else if (picked.kind === 'many')
      store.choose(
        picked.hits.map((one) => ({
          target: { kind: targetKind(one.layer), id: one.id },
          label: choiceLabel(one.id, one.layer),
        })),
      );
    else store.select(null);
    selectedByClick = false;
  });

  // The pointer shows what a click reaches.
  for (const layer of GROUPS.flat()) {
    map.on('mouseenter', layer, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = '';
    });
  }

  const handle: GlobeHandle = {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      if (mounted.get(container) === handle) mounted.delete(container);
      unsubscribe();
      reduced.removeEventListener('change', onReduced);
      container.removeEventListener('keydown', onKey);
      observer.disconnect();
      stopTheme();
      animation.destroy();
      for (const one of reviewLabels) one.marker.remove();
      for (const marker of exportLabels) marker.remove();
      map.remove();
    },
  };
  mounted.set(container, handle);
  return handle;
}
