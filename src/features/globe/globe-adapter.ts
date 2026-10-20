// The one file that touches the map library. The panels drive the globe through the store, and
// this file is the view of the store that draws on the canvas.

import { PRODUCTS, type ProductKey } from '@gab/proposal/chain-product';
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
import { frameOf, highlightOf, pickHit, type Under } from './globe-view';

// External constraint: the library parses no oklch colour and no CSS custom property, so the
// ground, the land and the marks are hex. The globe is a dark island in a light page, in both
// themes, so there is one set and no observer of the theme class.
const GROUND = '#0b1220';
const MARK = '#4aa8ff';
const IN_REVIEW = '#9aa3ad';
const LAND = '#1c2a3d';
const COAST = '#3b4f6b';
// The head of the pulse that runs along a link.
const PULSE = '#ffffff';
const SELECTED = '#ffffff';
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
// The pulse runs along a link in this time, then waits for a short time.
const PULSE_MS = 2600;

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

const pulseLayer = (key: ProductKey): string => `pulse-${key}`;

/** A gradient along a line, with a bright head at `progress` (0 to 1) and a short tail behind it. */
const pulseAt = (progress: number): ExpressionSpecification => {
  // Origin of the numbers: an interpolation needs its inputs in strictly ascending order, so the
  // head stays between 0.13 and 0.97, with a tail of 0.12 and a front of 0.02.
  const head = 0.13 + 0.84 * Math.min(Math.max(progress, 0), 1);
  const clear = 'rgba(0,0,0,0)';
  return [
    'interpolate',
    ['linear'],
    ['line-progress'],
    0,
    clear,
    head - 0.12,
    clear,
    head,
    PULSE,
    head + 0.02,
    clear,
    1,
    clear,
  ];
};

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
}

export interface GlobeHandle {
  readonly destroy: () => void;
}

// A second mount on the same element finds the first and ends it. React runs an effect twice in
// development, and a second WebGL context makes the browser drop the older one.
const mounted = new WeakMap<HTMLElement, GlobeHandle>();

/** Draws the globe in `container` and follows the store. Gives null when the browser cannot draw
 * it, and the store then says so. */
export function mountGlobe({ container, data, store }: MountOptions): GlobeHandle | null {
  mounted.get(container)?.destroy();
  if (!hasWebGL2()) {
    store.setUnavailable();
    return null;
  }

  const style: StyleSpecification = {
    version: 8,
    projection: { type: 'globe' },
    // A change of paint is a state change and not a fade of 300 ms, which is the default.
    transition: { duration: store.get().moving ? CHANGE_MS : 0, delay: 0 },
    sky: {
      'sky-color': '#0b1a33',
      'horizon-color': '#1d3b66',
      'fog-color': GROUND,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    },
    // The basemap is a file of the bundle: the outlines of the countries, Natural Earth (public
    // domain). The globe sends no request to a tile server.
    sources: {
      countries: { type: 'geojson', data: countriesUrl },
      entities: { type: 'geojson', data: data.entities },
      // The pulse reads the progress along each line.
      arcs: { type: 'geojson', data: data.arcs, lineMetrics: true },
      exits: { type: 'geojson', data: data.exits },
    },
    layers: [
      { id: 'ground', type: 'background', paint: { 'background-color': GROUND } },
      { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': LAND } },
      {
        id: 'coast',
        type: 'line',
        source: 'countries',
        paint: { 'line-color': COAST, 'line-width': 0.6 },
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
        paint: { 'line-color': SELECTED, 'line-width': 6, 'line-opacity': 0.5 },
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
      // A pulse runs along each link that is a flow of the record. A gradient reads no property of
      // the feature, so each product has its own layer. A link in review is not a fact, and a
      // capacity is not a flow, so neither carries a pulse.
      ...PRODUCTS.map((one): LineLayerSpecification => ({
        id: pulseLayer(one.key),
        type: 'line',
        source: 'arcs',
        filter: [
          'all',
          ['==', ['get', 'product'], one.key],
          ['!=', ['get', 'style'], 'in review'],
          ['!=', ['get', 'style'], 'capacity'],
        ],
        layout: { 'line-cap': 'round', visibility: 'none' },
        paint: { 'line-width': 3, 'line-blur': 1, 'line-gradient': pulseAt(0.5) },
      })),
      {
        id: 'points',
        type: 'circle',
        source: 'entities',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': ['coalesce', ['get', 'colour'], MARK],
          'circle-radius': 6,
          'circle-stroke-color': GROUND,
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
          'circle-stroke-color': SELECTED,
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
          'circle-radius': 10,
          'circle-stroke-color': ['case', ['get', 'inReview'], IN_REVIEW, ['get', 'colour']],
          'circle-stroke-width': 2.5,
        },
      },
    ],
  };

  let map: MapLibre;
  try {
    map = new MapLibre({ container, style, center: [0, 30], zoom: 1 });
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

  // The library measures the container once, while the chrome around it is still being built.
  map.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

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
    const highlight = highlightOf(data, { entity, step: state.step, product: state.product });
    const assets = forward(highlight?.assets ?? null);
    map.setPaintProperty('points', 'circle-opacity', assets);
    map.setPaintProperty('points', 'circle-stroke-opacity', assets);
    map.setPaintProperty('lines', 'line-opacity', assets);
    map.setPaintProperty('areas', 'fill-opacity', [
      '*',
      0.3,
      assets,
    ] satisfies ExpressionSpecification);
    map.setPaintProperty('exits', 'circle-stroke-opacity', forward(highlight?.exits ?? null));
    const selection: FilterSpecification = ['==', ['get', 'id'], entity ?? ''];
    map.setFilter('selected-point', ['all', ['==', ['geometry-type'], 'Point'], selection]);
    map.setFilter('selected-line', ['all', ['!=', ['geometry-type'], 'Point'], selection]);
    const arcFilter: FilterSpecification =
      state.product === 'all' ? ['boolean', true] : ['==', ['get', 'product'], state.product];
    const arcs = forward(highlight?.arcs ?? null);
    for (const one of ARC_LAYERS) {
      map.setFilter(one.id, ['all', ['==', ['get', 'style'], one.style], arcFilter]);
      map.setPaintProperty(
        one.id,
        'line-opacity',
        typeof arcs === 'number'
          ? one.opacity * arcs
          : (['*', one.opacity, arcs] satisfies ExpressionSpecification),
      );
    }
    for (const one of PRODUCTS) {
      map.setLayoutProperty(
        pulseLayer(one.key),
        'visibility',
        state.moving && (state.product === 'all' || state.product === one.key) ? 'visible' : 'none',
      );
      map.setPaintProperty(pulseLayer(one.key), 'line-opacity', arcs);
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

  // The pulse runs along each link in 2.6 seconds. It stops with the motion.
  const start = performance.now();
  let frameRequest = 0;
  const pulse = (now: number): void => {
    frameRequest = 0;
    if (destroyed || !store.get().moving) return;
    const progress = (((now - start) / PULSE_MS) % 1) * 1.15;
    for (const one of PRODUCTS)
      map.setPaintProperty(pulseLayer(one.key), 'line-gradient', pulseAt(Math.min(progress, 1)));
    frameRequest = requestAnimationFrame(pulse);
  };

  // What the previous state looked like, so a change moves the camera once.
  let seen: GlobeState = store.get();
  // A click on the globe selects what the reader sees, so the camera stays where it is.
  let selectedByClick = false;
  const frameStep = (state: GlobeState): void => {
    const step = data.steps.find((one) => one.key === state.step);
    const framed =
      step === undefined
        ? null
        : frameOf(data.places, [...step.assets, ...step.arcs, ...step.exits]);
    if (framed !== null)
      map.fitBounds(framed, { padding: 60, maxZoom: 5, duration: state.moving ? CHANGE_MS : 0 });
  };
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
      if (state.step !== before.step) frameStep(state);
      const entity = selectedEntity(state);
      if (entity !== null && entity !== selectedEntity(before) && !selectedByClick)
        centreOn(entity);
    });
  };

  map.on('load', () => {
    loaded = true;
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
      frameStep(state);
    } else spin();
    if (state.moving) frameRequest = requestAnimationFrame(pulse);
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
      if (frameRequest !== 0) cancelAnimationFrame(frameRequest);
      for (const one of reviewLabels) one.marker.remove();
      for (const marker of exportLabels) marker.remove();
      map.remove();
    },
  };
  mounted.set(container, handle);
  return handle;
}
