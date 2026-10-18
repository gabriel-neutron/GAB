import {
  Map as MapLibre,
  Marker,
  type ExpressionSpecification,
  type FilterSpecification,
  type LineLayerSpecification,
  type StyleSpecification,
} from 'maplibre-gl';

import { chainOf, productChain, type Highlight } from '@gab/proposal/chain-highlight';
import { PRODUCTS, type ProductKey } from '@gab/proposal/chain-product';
import { positions, type Position } from '@gab/proposal/geometry-positions';
import { LINK } from './site-style.ts';
import {
  CAPTION_ELEMENT,
  CARD_ELEMENT,
  CARDS_ELEMENT,
  FEATURES_ELEMENT,
  FLOWS_ELEMENT,
  MAP_ELEMENT,
  NO_MAP_ELEMENT,
} from './map-elements.ts';

// External constraint: MapLibre parses no oklch colour, so the map takes its dark ground, its
// land and its marks in hex. The hues of the stages and the products are light ones for this ground.
const GROUND = '#0b1220';
const MARK = '#4aa8ff';
const IN_REVIEW = '#9aa3ad';
// The head of the pulse that runs along a link.
const PULSE = '#ffffff';
// Origin of the number: at this opacity a dimmed point stays visible on the dark land, and a
// point put forward reads at once.
const DIMMED = 0.35;

// The basemap is a file of the site: the outlines of the countries, from Natural Earth (public
// domain). The site sends no request to a tile server.
// External constraint: Vite builds a literal `new URL` into the script, and the file must stay a
// file of its own beside it. A name in a constant stays a request at run time.
const COUNTRIES_FILE = './countries.json';
const COUNTRIES = new URL(COUNTRIES_FILE, import.meta.url).href;
const LAND = '#1c2a3d';
const COAST = '#3b4f6b';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const read = (id: string): unknown =>
  JSON.parse(document.getElementById(id)?.textContent ?? 'null');

const featuresOf = (value: unknown): unknown[] =>
  isRecord(value) && Array.isArray(value['features']) ? value['features'] : [];

const container = document.getElementById(MAP_ELEMENT);
const features = featuresOf(read(FEATURES_ELEMENT));
const flows = read(FLOWS_ELEMENT);
const arcs = featuresOf(isRecord(flows) ? flows['arcs'] : null);
const exits = featuresOf(isRecord(flows) ? flows['exits'] : null);

const productOf = (value: unknown): ProductKey | undefined =>
  PRODUCTS.find((one) => one.key === value)?.key;

/** The links of the chain, read back from the page and checked one by one. */
const links = (() => {
  const held = isRecord(flows) && isRecord(flows['links']) ? flows['links'] : {};
  const arcList = Array.isArray(held['arcs']) ? held['arcs'] : [];
  const exitList = Array.isArray(held['exits']) ? held['exits'] : [];
  return {
    arcs: arcList.flatMap((one: unknown) => {
      if (!isRecord(one)) return [];
      const product = productOf(one['product']);
      if (product === undefined) return [];
      return [
        {
          id: text(one['id']),
          product,
          fromId: text(one['fromId']),
          toId: text(one['toId']),
          inReview: one['inReview'] === true,
          volumes: (Array.isArray(one['volumes']) ? one['volumes'] : []).flatMap((line: unknown) =>
            isRecord(line)
              ? [
                  {
                    text: text(line['text']),
                    source: text(line['source']),
                    href: typeof line['href'] === 'string' ? line['href'] : null,
                  },
                ]
              : [],
          ),
        },
      ];
    }),
    exits: exitList.flatMap((one: unknown) =>
      isRecord(one) && Array.isArray(one['assets'])
        ? [{ id: text(one['id']), assets: one['assets'].map(text) }]
        : [],
    ),
  };
})();

const idsOf = (value: unknown): string[] => (Array.isArray(value) ? value.map(text) : []);

/** The six steps of the chain, read back from the page: the sentence and what each step puts
 * forward. */
const steps = (isRecord(flows) && Array.isArray(flows['steps']) ? flows['steps'] : []).flatMap(
  (one: unknown) =>
    isRecord(one)
      ? [
          {
            key: text(one['key']),
            sentence: text(one['sentence']),
            assets: new Set(idsOf(one['assets'])),
            arcs: new Set(idsOf(one['arcs'])),
            exits: new Set(idsOf(one['exits'])),
          },
        ]
      : [],
);

const propertiesOf = (one: unknown): Record<string, unknown> =>
  isRecord(one) && isRecord(one['properties']) ? one['properties'] : {};

const geometryOf = (one: unknown): unknown =>
  isRecord(one) && isRecord(one['geometry']) ? one['geometry']['coordinates'] : null;

interface ArcLayer {
  readonly id: string;
  readonly style: string;
  /** The property that gives the width, or a fixed width. */
  readonly width: 'width' | 'halo' | number;
  readonly dash: number[] | null;
  readonly colour: 'product' | 'review' | 'land';
  readonly opacity: number;
}

// The layers of the arcs, from the bottom. An estimate is hatched over a pale halo of its range,
// and a capacity is a hollow line: a line of the land inside a line of the product.
const ARC_LAYERS: readonly ArcLayer[] = [
  {
    id: 'arcs-halo',
    style: 'estimated',
    width: 'halo',
    dash: null,
    colour: 'product',
    opacity: 0.25,
  },
  { id: 'arcs-solid', style: 'solid', width: 'width', dash: null, colour: 'product', opacity: 1 },
  {
    id: 'arcs-dashed',
    style: 'dashed',
    width: 'width',
    dash: [3, 2],
    colour: 'product',
    opacity: 1,
  },
  {
    id: 'arcs-review',
    style: 'in review',
    width: 'width',
    dash: [0.5, 1.5],
    colour: 'review',
    opacity: 1,
  },
  {
    id: 'arcs-observed',
    style: 'observed',
    width: 'width',
    dash: null,
    colour: 'product',
    opacity: 1,
  },
  {
    id: 'arcs-estimated',
    style: 'estimated',
    width: 'width',
    dash: [1, 1],
    colour: 'product',
    opacity: 1,
  },
  {
    id: 'arcs-capacity',
    style: 'capacity',
    width: 'width',
    dash: null,
    colour: 'product',
    opacity: 1,
  },
  {
    id: 'arcs-capacity-inside',
    style: 'capacity',
    width: 1.5,
    dash: null,
    colour: 'land',
    opacity: 1,
  },
];

const ARC_COLOURS: Readonly<Record<ArcLayer['colour'], string | ExpressionSpecification>> = {
  product: ['coalesce', ['get', 'colour'], MARK],
  review: IN_REVIEW,
  land: LAND,
};

// External constraint: MapLibre draws with WebGL 2 only. With no WebGL 2, the page says so, the
// controls and the card of the map go, and the list of the entities below the map stays.
const hasWebGL = (): boolean => document.createElement('canvas').getContext('webgl2') !== null;

const noMap = (): void => {
  document.getElementById(NO_MAP_ELEMENT)?.removeAttribute('hidden');
  document.getElementById(CARD_ELEMENT)?.setAttribute('hidden', '');
  for (const control of document.querySelectorAll(
    '[data-product], [data-play], [data-motion], [data-step]',
  ))
    control.closest('[role="group"], div')?.setAttribute('hidden', '');
};

// The reader asks for reduced motion: no pulse, no spin, no camera flight, and no control to stop
// a motion that does not start.
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

// A map that cannot start gives the same page as a browser with no WebGL.
const startMap = (options: ConstructorParameters<typeof MapLibre>[0]): MapLibre | null => {
  try {
    return new MapLibre(options);
  } catch {
    noMap();
    return null;
  }
};

if (container !== null && !hasWebGL()) noMap();
else if (container !== null) {
  const style: StyleSpecification = {
    version: 8,
    projection: { type: 'globe' },
    sky: {
      'sky-color': '#0b1a33',
      'horizon-color': '#1d3b66',
      'fog-color': GROUND,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    },
    sources: {
      countries: { type: 'geojson', data: COUNTRIES },
      entities: { type: 'geojson', data: { type: 'FeatureCollection', features } },
      // The pulse reads the progress along each line.
      arcs: {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: arcs },
        lineMetrics: true,
      },
      exits: { type: 'geojson', data: { type: 'FeatureCollection', features: exits } },
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
      // A pulse runs along each link that is a fact. A gradient reads no property of the feature, so
      // each product has its own layer.
      ...PRODUCTS.map((one): LineLayerSpecification => ({
        id: `pulse-${one.key}`,
        type: 'line',
        source: 'arcs',
        filter: ['all', ['==', ['get', 'product'], one.key], ['!=', ['get', 'style'], 'in review']],
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
  const started = startMap({ container, style, center: [0, 30], zoom: 1 });
  // The page already shows the line for no map, and the rest of the script needs the map.
  if (started === null) throw new Error('The map did not start.');
  const map = started;
  // The page can change width after the map starts, for example when a scroll bar comes, and
  // MapLibre follows only the window.
  new ResizeObserver(() => {
    map.resize();
  }).observe(container);

  const all = features.flatMap((one: unknown) => positions(geometryOf(one)));
  const [start] = all;
  if (start !== undefined) {
    const west = Math.min(...all.map(([lon]) => lon));
    const east = Math.max(...all.map(([lon]) => lon));
    const south = Math.min(...all.map(([, lat]) => lat));
    const north = Math.max(...all.map(([, lat]) => lat));
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      // Origin of the number: at zoom 4 the map shows about 20 degrees, so the coast is in view
      // also around one point.
      { padding: 60, maxZoom: 4, duration: 0 },
    );
  }

  // A label on the map is a marker built from text nodes, because the basemap has no font file
  // and a label comes from an untrusted page.
  const label = (words: string, at: unknown): Marker | null => {
    const [where] = positions(at);
    if (where === undefined) return null;
    const element = document.createElement('span');
    element.textContent = words;
    element.className = 'border border-border bg-background px-1 text-small/4';
    return new Marker({ element, anchor: 'top', offset: [0, 8] }).setLngLat([...where]);
  };

  // Each link in review carries the words "in review" at the middle of its line, so the map never
  // shows it as a fact.
  const reviewLabels = arcs.flatMap((one: unknown) => {
    const properties = propertiesOf(one);
    if (properties['style'] !== 'in review') return [];
    const path = positions(geometryOf(one));
    const marker = label('in review', path[Math.floor(path.length / 2)]);
    return marker === null ? [] : [{ product: productOf(properties['product']), marker }];
  });

  const exportLabels = features.flatMap((one: unknown) => {
    const properties = propertiesOf(one);
    if (properties['stageKey'] !== 'export') return [];
    const marker = label(text(properties['label']), geometryOf(one));
    return marker === null ? [] : [marker];
  });

  // The page renders each card in a hidden holder, so the script only copies the selected one.
  const holderOfCards = document.getElementById(CARDS_ELEMENT);
  const cardBox = document.getElementById(CARD_ELEMENT);
  // The card of an exit point and of an arc is built from text nodes, because a label comes from
  // an untrusted page.
  const element = (tag: string, content: string): HTMLElement => {
    const one = document.createElement(tag);
    one.textContent = content;
    return one;
  };
  const heading = (words: string): HTMLElement => {
    const title = element('h2', words);
    title.className = 'font-medium';
    return title;
  };
  const showCard = (id: string): void => {
    const card = [...(holderOfCards?.children ?? [])].find(
      (one) => one instanceof HTMLElement && one.dataset['card'] === id,
    );
    if (cardBox === null || card === undefined) return;
    cardBox.replaceChildren(...[...card.childNodes].map((one) => one.cloneNode(true)));
  };
  const reviewMark = (words: string): HTMLElement => {
    const mark = element('p', words);
    mark.className = 'text-candidate';
    return mark;
  };
  const showExit = (properties: Record<string, unknown>): void => {
    cardBox?.replaceChildren(
      heading(text(properties['label'])),
      ...(properties['inReview'] === true
        ? [reviewMark('In review: this exit point rests on a proposal, not a fact.')]
        : []),
      element(
        'p',
        'Exit from Russian control. The release computes this point from its relations: it is not an entity of the record.',
      ),
      element('p', text(properties['why'])),
    );
  };
  const sourceOf = (line: { source: string; href: string | null }): HTMLElement => {
    const paragraph = element('p', '');
    paragraph.className = 'text-muted-foreground';
    if (line.href === null) paragraph.textContent = line.source;
    else {
      const link = element('a', line.source);
      link.setAttribute('href', line.href);
      link.setAttribute('rel', 'noreferrer');
      link.className = LINK;
      paragraph.append(link);
    }
    return paragraph;
  };
  const showArc = (properties: Record<string, unknown>): void => {
    const product = PRODUCTS.find((one) => one.key === properties['product'])?.label ?? '';
    const arc = links.arcs.find((one) => one.id === text(properties['id']));
    const volumes = arc?.volumes ?? [];
    cardBox?.replaceChildren(
      heading(text(properties['label'])),
      element('p', `Physical link, ${product.toLowerCase()}.`),
      ...(arc?.inReview === true || properties['style'] === 'in review'
        ? [
            reviewMark(
              'In review: the link is a proposal, not a fact, and so is each volume below.',
            ),
          ]
        : []),
      ...(volumes.length === 0
        ? [element('p', 'The volume table of this release has no row for this link.')]
        : volumes.flatMap((line) => [element('p', line.text), sourceOf(line)])),
    );
  };

  // What the reader asked: one product chain, one step, one asset. An asset puts its chain
  // forward, else a step puts its assets and its links forward, else the product chain does.
  let product: ProductKey | 'all' = 'all';
  let step: (typeof steps)[number] | null = null;
  let selected: string | null = null;

  // The address keeps the product chain and the step, so a reload keeps them. The script reads the
  // address once, at the start, and checks each value against the steps of the page.
  {
    const asked = new URLSearchParams(window.location.hash.slice(1));
    product = productOf(asked.get('product')) ?? 'all';
    step = steps.find((one) => one.key === asked.get('step')) ?? null;
  }
  const keepInAddress = (): void => {
    const kept = new URLSearchParams();
    if (product !== 'all') kept.set('product', product);
    if (step !== null) kept.set('step', step.key);
    const hash = kept.toString();
    window.history.replaceState(
      null,
      '',
      hash === '' ? `${window.location.pathname}${window.location.search}` : `#${hash}`,
    );
  };

  const forward = (ids: ReadonlySet<string> | null): ExpressionSpecification | number =>
    ids === null ? 1 : ['case', ['in', ['get', 'id'], ['literal', [...ids]]], 1, DIMMED];

  const caption = document.getElementById(CAPTION_ELEMENT);
  const draw = (): void => {
    const highlight: Highlight | null =
      selected !== null
        ? chainOf(links, selected)
        : (step ?? (product !== 'all' ? productChain(links, product) : null));
    for (const layer of ['points', 'lines'] as const)
      map.setPaintProperty(
        layer,
        layer === 'points' ? 'circle-opacity' : 'line-opacity',
        forward(highlight?.assets ?? null),
      );
    map.setPaintProperty('points', 'circle-stroke-opacity', forward(highlight?.assets ?? null));
    map.setPaintProperty('areas', 'fill-opacity', [
      '*',
      0.3,
      forward(highlight?.assets ?? null),
    ] satisfies ExpressionSpecification);
    const exitOpacity = forward(highlight?.exits ?? null);
    map.setPaintProperty('exits', 'circle-stroke-opacity', exitOpacity);
    const arcFilter: FilterSpecification =
      product === 'all' ? ['boolean', true] : ['==', ['get', 'product'], product];
    const arcOpacity = forward(highlight?.arcs ?? null);
    for (const one of ARC_LAYERS) {
      map.setFilter(one.id, ['all', ['==', ['get', 'style'], one.style], arcFilter]);
      map.setPaintProperty(
        one.id,
        'line-opacity',
        typeof arcOpacity === 'number'
          ? one.opacity * arcOpacity
          : (['*', one.opacity, arcOpacity] satisfies ExpressionSpecification),
      );
    }
    for (const one of PRODUCTS) {
      const pulse = `pulse-${one.key}`;
      map.setLayoutProperty(
        pulse,
        'visibility',
        moving && (product === 'all' || product === one.key) ? 'visible' : 'none',
      );
      map.setPaintProperty(pulse, 'line-opacity', arcOpacity);
    }
    for (const one of reviewLabels)
      if (product === 'all' || one.product === product) one.marker.addTo(map);
      else one.marker.remove();
    for (const marker of exportLabels)
      if (step?.key === 'terminal' && selected === null) marker.addTo(map);
      else marker.remove();
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-product]'))
      button.setAttribute('aria-pressed', String(button.dataset['product'] === product));
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-step]'))
      button.setAttribute('aria-pressed', String(button.dataset['step'] === step?.key));
    if (caption !== null) caption.textContent = selected === null ? (step?.sentence ?? '') : '';
  };

  // The camera goes to what a step puts forward. With reduced motion, it jumps.
  const placesOf = (list: readonly unknown[]): [string, Position[]][] =>
    list.map((one) => [text(propertiesOf(one)['id']), positions(geometryOf(one))]);
  const places = new Map([...placesOf(features), ...placesOf(arcs), ...placesOf(exits)]);
  const frame = (shown: NonNullable<typeof step>): void => {
    const all = [...shown.assets, ...shown.arcs, ...shown.exits].flatMap(
      (id) => places.get(id) ?? [],
    );
    if (all.length === 0) return;
    map.fitBounds(
      [
        [Math.min(...all.map(([lon]) => lon)), Math.min(...all.map(([, lat]) => lat))],
        [Math.max(...all.map(([lon]) => lon)), Math.max(...all.map(([, lat]) => lat))],
      ],
      { padding: 60, maxZoom: 5, duration: moving ? 2000 : 0 },
    );
  };

  // The motion that starts by itself: the pulse, the spin and the camera flight. "Stop motion"
  // stops all of it for the rest of the visit.
  let moving = !still;

  // The globe turns slowly until the reader acts. Each turn starts when the one before it ends.
  let spinning = moving;
  const spin = (): void => {
    if (!spinning) return;
    const centre = map.getCenter();
    map.easeTo({ center: [centre.lng - 6, centre.lat], duration: 2000, easing: (t) => t });
  };
  const stopSpin = (): void => {
    spinning = false;
  };
  map.on('moveend', spin);

  // "Play the chain" goes to the next step every few seconds. With no motion, each press goes to
  // the next step, and nothing moves by itself. The button changes its name only, so a screen
  // reader says what a press does.
  const play = document.querySelector<HTMLButtonElement>('[data-play]');
  // Origin of the number: the camera flight takes 2 seconds, and the reader needs about 3 more
  // to read the sentence of the step.
  const STEP_TIME = 5000;
  let timer: ReturnType<typeof setInterval> | null = null;
  const stopPlay = (): void => {
    if (timer !== null) clearInterval(timer);
    timer = null;
    if (play !== null) play.textContent = moving ? 'Play the chain' : 'Next step';
  };
  // An action of the reader on the map stops the spin and "Play the chain".
  const stopAll = (): void => {
    stopSpin();
    stopPlay();
  };
  for (const event of ['mousedown', 'touchstart', 'wheel', 'dragstart'] as const)
    map.on(event, stopAll);
  container.addEventListener('keydown', stopAll);
  stopPlay();
  const goTo = (next: NonNullable<typeof step> | null): void => {
    stopSpin();
    step = next;
    selected = null;
    keepInAddress();
    draw();
    if (next !== null) frame(next);
  };
  const nextStep = (): void => {
    goTo(steps[(step === null ? -1 : steps.indexOf(step)) + 1] ?? steps[0] ?? null);
  };
  play?.addEventListener('click', () => {
    if (!moving) {
      nextStep();
      return;
    }
    if (timer !== null) {
      stopPlay();
      return;
    }
    nextStep();
    timer = setInterval(nextStep, STEP_TIME);
    play.textContent = 'Pause';
  });

  const motion = document.querySelector<HTMLButtonElement>('[data-motion]');
  if (still) motion?.setAttribute('hidden', '');
  motion?.addEventListener('click', () => {
    moving = false;
    stopAll();
    motion.setAttribute('aria-pressed', 'true');
    motion.disabled = true;
    draw();
  });

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-product]'))
    button.addEventListener('click', () => {
      stopPlay();
      product = productOf(button.dataset['product']) ?? 'all';
      selected = null;
      keepInAddress();
      draw();
    });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-step]'))
    button.addEventListener('click', () => {
      stopPlay();
      const key = button.dataset['step'];
      goTo(step?.key === key ? null : (steps.find((one) => one.key === key) ?? null));
    });

  map.on('load', () => {
    draw();
    if (step !== null) frame(step);
    else spin();
    // The pulse runs along each link in 2.6 seconds, then waits for a short time. It stops with
    // the motion.
    const start = performance.now();
    const pulse = (now: number): void => {
      if (!moving) return;
      const progress = (((now - start) / 2600) % 1) * 1.15;
      for (const one of PRODUCTS)
        map.setPaintProperty(`pulse-${one.key}`, 'line-gradient', pulseAt(Math.min(progress, 1)));
      requestAnimationFrame(pulse);
    };
    requestAnimationFrame(pulse);
  });
  const openEntity = (id: string): void => {
    stopAll();
    selected = id;
    step = null;
    keepInAddress();
    showCard(id);
    draw();
  };

  interface Hit {
    readonly layer: string;
    readonly properties: Record<string, unknown>;
  }
  const open = (hit: Hit): void => {
    stopAll();
    if (hit.layer === 'exits') showExit(hit.properties);
    else if (hit.layer.startsWith('arcs')) showArc(hit.properties);
    else openEntity(text(hit.properties['id']));
  };

  // When the click hits more than one point, the card lists each of them, and the reader chooses.
  const choose = (hits: readonly Hit[]): void => {
    const list = element('ul', '');
    list.className = 'flex flex-col';
    for (const hit of hits) {
      const button = element(
        'button',
        `${text(hit.properties['label'])}${hit.layer === 'exits' ? ' (exit point)' : ''}`,
      );
      button.setAttribute('type', 'button');
      button.className =
        'w-full px-1 py-0.5 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring';
      button.addEventListener('click', () => {
        open(hit);
      });
      const item = element('li', '');
      item.append(button);
      list.append(item);
    }
    cardBox?.replaceChildren(
      heading(`${String(hits.length)} points under the click`),
      element('p', 'Select one for its card.'),
      list,
    );
  };

  // A point wins over an exit ring, a ring over a line or an area, and each of them over an arc. An
  // exit ring lies around its asset: a click on the point opens the asset, and a click on the ring
  // opens the exit point.
  const GROUPS: readonly (readonly string[])[] = [
    ['points'],
    ['exits'],
    ['lines', 'areas'],
    ARC_LAYERS.map((one) => one.id),
  ];
  map.on('click', (event) => {
    const hits = map.queryRenderedFeatures(event.point, { layers: GROUPS.flat() });
    for (const group of GROUPS) {
      const found = new Map<string, Hit>();
      for (const one of hits)
        if (group.includes(one.layer.id)) {
          const properties: Record<string, unknown> = one.properties;
          const id = text(properties['id']);
          if (!found.has(id)) found.set(id, { layer: one.layer.id, properties });
        }
      const [only, ...others] = [...found.values()];
      if (only === undefined) continue;
      if (others.length === 0 || group === GROUPS.at(-1)) open(only);
      else choose([only, ...others]);
      return;
    }
    selected = null;
    draw();
  });
}
