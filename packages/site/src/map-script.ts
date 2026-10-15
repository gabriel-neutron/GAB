import {
  Map as MapLibre,
  Marker,
  type ExpressionSpecification,
  type FilterSpecification,
  type LineLayerSpecification,
  type StyleSpecification,
} from 'maplibre-gl';

import { chainOf, productChain, type Highlight } from './chain-highlight.ts';
import { PRODUCTS, type ProductKey } from './chain-product.ts';
import { positions } from './geometry-positions.ts';
import {
  CARD_ELEMENT,
  CARDS_ELEMENT,
  FEATURES_ELEMENT,
  FLOWS_ELEMENT,
  MAP_ELEMENT,
} from './map-elements.ts';

// External constraint: MapLibre parses no oklch colour, so the map takes the hex of the muted
// ground of the light theme.
const GROUND = '#eceef0';
const MARK = '#0b6aa2';
const IN_REVIEW = '#8a8f94';
// Origin of the number: at this opacity a dimmed point stays visible on the white land, and a
// point put forward reads at once.
const DIMMED = 0.15;

// The basemap is a file of the site: the outlines of the countries, from Natural Earth (public
// domain). The site sends no request to a tile server (ADR 0020).
// External constraint: Vite builds a literal `new URL` into the script, and the file must stay a
// file of its own beside it. A name in a constant stays a request at run time.
const COUNTRIES_FILE = './countries.json';
const COUNTRIES = new URL(COUNTRIES_FILE, import.meta.url).href;
const LAND = '#ffffff';
const COAST = '#9aa0a6';

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

const propertiesOf = (one: unknown): Record<string, unknown> =>
  isRecord(one) && isRecord(one['properties']) ? one['properties'] : {};

const geometryOf = (one: unknown): unknown =>
  isRecord(one) && isRecord(one['geometry']) ? one['geometry']['coordinates'] : null;

const ARC_STYLES: readonly { id: string; style: string; dash: number[] | null }[] = [
  { id: 'arcs-solid', style: 'solid', dash: null },
  { id: 'arcs-dashed', style: 'dashed', dash: [3, 2] },
  { id: 'arcs-review', style: 'in review', dash: [0.5, 1.5] },
];

if (container !== null) {
  const style: StyleSpecification = {
    version: 8,
    sources: {
      countries: { type: 'geojson', data: COUNTRIES },
      entities: { type: 'geojson', data: { type: 'FeatureCollection', features } },
      arcs: { type: 'geojson', data: { type: 'FeatureCollection', features: arcs } },
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
      ...ARC_STYLES.map((one): LineLayerSpecification => ({
        id: one.id,
        type: 'line',
        source: 'arcs',
        filter: ['==', ['get', 'style'], one.style],
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color':
            one.style === 'in review' ? IN_REVIEW : ['coalesce', ['get', 'colour'], MARK],
          'line-width': ['get', 'width'],
          ...(one.dash === null ? {} : { 'line-dasharray': one.dash }),
        },
      })),
      {
        id: 'points',
        type: 'circle',
        source: 'entities',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-color': ['coalesce', ['get', 'colour'], MARK],
          'circle-radius': 6,
          'circle-stroke-color': '#ffffff',
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
  const map = new MapLibre({ container, style, center: [0, 30], zoom: 1 });
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

  // The card is built from text nodes, because a label comes from an untrusted page.
  const cards: unknown = read(CARDS_ELEMENT);
  const cardBox = document.getElementById(CARD_ELEMENT);
  const element = (tag: string, content: string): HTMLElement => {
    const one = document.createElement(tag);
    one.textContent = content;
    return one;
  };
  const link = (href: string, words: string): HTMLAnchorElement => {
    const one = document.createElement('a');
    one.href = href;
    one.textContent = words;
    one.className = 'underline';
    return one;
  };
  const heading = (words: string): HTMLElement => {
    const title = element('h2', words);
    title.className = 'font-medium';
    return title;
  };
  const showCard = (id: string): void => {
    const card = isRecord(cards) ? cards[id] : undefined;
    if (cardBox === null || !isRecord(card)) return;
    const body: HTMLElement[] = [];
    const title = heading('');
    title.append(link(text(card['href']), text(card['label'])));
    body.push(title);
    body.push(element('p', [text(card['type']), text(card['stage'])].filter(Boolean).join(', ')));
    const values = Array.isArray(card['values']) ? card['values'] : [];
    const relations = Array.isArray(card['relations']) ? card['relations'] : [];
    const list = (words: string, items: HTMLElement[]): void => {
      if (items.length === 0) return;
      const section = element('h3', words);
      section.className = 'mt-2 text-label';
      const ul = document.createElement('ul');
      ul.append(...items);
      body.push(section, ul);
    };
    list(
      'Values',
      values.flatMap((one: unknown) => {
        if (!isRecord(one)) return [];
        const item = element('li', `${text(one['key'])}: ${text(one['value'])}`);
        item.title = text(one['label']);
        return [item];
      }),
    );
    list(
      'Relations',
      relations.flatMap((one: unknown) => {
        if (!isRecord(one)) return [];
        const item = document.createElement('li');
        const dates = [text(one['from']), text(one['to'])];
        const interval = dates.some(Boolean) ? ` (${dates[0]} to ${dates[1]})` : '';
        item.append(
          `${text(one['words'])} `,
          link(text(one['otherHref']), text(one['otherLabel'])),
          interval,
        );
        item.title = text(one['label']);
        return [item];
      }),
    );
    const review = typeof card['inReview'] === 'number' ? card['inReview'] : 0;
    if (review > 0) body.push(element('p', `${String(review)} in review, not shown.`));
    body.push(element('p', 'Sources and events: see the page of the entity.'));
    cardBox.replaceChildren(...body);
  };
  const showExit = (properties: Record<string, unknown>): void => {
    cardBox?.replaceChildren(
      heading(text(properties['label'])),
      element(
        'p',
        'Exit from Russian control. The release computes this point from its relations: it is not an entity of the record.',
      ),
      element('p', text(properties['why'])),
    );
  };
  const showArc = (properties: Record<string, unknown>): void => {
    const product = PRODUCTS.find((one) => one.key === properties['product'])?.label ?? '';
    cardBox?.replaceChildren(
      heading(text(properties['label'])),
      element('p', `Physical link, ${product.toLowerCase()}.`),
      ...(properties['style'] === 'in review'
        ? [element('p', 'In review: the link is a proposal, not a fact.')]
        : []),
    );
  };

  // What the reader asked: one product chain, one stage, one asset. An asset puts its chain
  // forward, else a stage puts its assets forward, else the product chain does.
  let product: ProductKey | 'all' = 'all';
  // The script takes the stage from a button of the page, and imports no list of stages: that list
  // reads the vocabulary of the record, which the script does not need.
  let stage: string | null = null;
  let selected: string | null = null;

  const stageHighlight = (key: string): Highlight => {
    const assets = new Set(
      features.flatMap((one: unknown) => {
        const properties = propertiesOf(one);
        return properties['stageKey'] === key ? [text(properties['id'])] : [];
      }),
    );
    const exitIds = key === 'exit' ? links.exits.map((one) => one.id) : [];
    return { assets, arcs: new Set(), exits: new Set(exitIds) };
  };

  const forward = (ids: ReadonlySet<string> | null): ExpressionSpecification | number =>
    ids === null ? 1 : ['case', ['in', ['get', 'id'], ['literal', [...ids]]], 1, DIMMED];

  const draw = (): void => {
    const highlight: Highlight | null =
      selected !== null
        ? chainOf(links, selected)
        : stage !== null
          ? stageHighlight(stage)
          : product !== 'all'
            ? productChain(links, product)
            : null;
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
    for (const one of ARC_STYLES) {
      map.setFilter(one.id, ['all', ['==', ['get', 'style'], one.style], arcFilter]);
      map.setPaintProperty(
        one.id,
        'line-opacity',
        highlight === null || stage !== null
          ? stage === null
            ? 1
            : DIMMED
          : forward(highlight.arcs),
      );
    }
    for (const one of reviewLabels)
      if (product === 'all' || one.product === product) one.marker.addTo(map);
      else one.marker.remove();
    for (const marker of exportLabels)
      if (stage === 'export' && selected === null) marker.addTo(map);
      else marker.remove();
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-product]'))
      button.setAttribute('aria-pressed', String(button.dataset['product'] === product));
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-stage]'))
      button.setAttribute('aria-pressed', String(button.dataset['stage'] === stage));
  };

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-product]'))
    button.addEventListener('click', () => {
      product = productOf(button.dataset['product']) ?? 'all';
      selected = null;
      draw();
    });
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-stage]'))
    button.addEventListener('click', () => {
      const key = button.dataset['stage'] ?? null;
      stage = stage === key ? null : key;
      selected = null;
      draw();
    });

  map.on('load', draw);
  map.on('click', (event) => {
    const hits = map.queryRenderedFeatures(event.point, {
      layers: ['exits', 'points', 'lines', 'areas', ...ARC_STYLES.map((one) => one.id)],
    });
    // An exit ring lies around its asset: a click on the point opens the asset, and a click on
    // the ring opens the exit point.
    const order = ['points', 'exits', 'lines', 'areas'];
    const rank = (id: string): number => {
      const at = order.indexOf(id);
      return at === -1 ? order.length : at;
    };
    const [hit] = hits.toSorted((a, b) => rank(a.layer.id) - rank(b.layer.id));
    if (hit === undefined) {
      selected = null;
      draw();
      return;
    }
    const properties: Record<string, unknown> = hit.properties;
    if (hit.layer.id === 'exits') showExit(properties);
    else if (hit.layer.source === 'arcs') showArc(properties);
    else {
      selected = text(properties['id']);
      stage = null;
      showCard(selected);
      draw();
    }
  });
}
