import { Map as MapLibre, type StyleSpecification } from 'maplibre-gl';

import { CARD_ELEMENT, CARDS_ELEMENT, FEATURES_ELEMENT, MAP_ELEMENT } from './map-elements.ts';

// External constraint: MapLibre parses no oklch colour, so the map takes the hex of the muted
// ground of the light theme.
const GROUND = '#eceef0';
const MARK = '#0b6aa2';

// The basemap is the standard tile layer of OpenStreetMap, under the tile policy of the
// OpenStreetMap Foundation. The attribution is an obligation of its licence: do not shorten it.
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '© OpenStreetMap contributors';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Each position of a GeoJSON geometry, at any depth. */
const positions = (value: unknown): [number, number][] => {
  if (!Array.isArray(value)) return [];
  const first: unknown = value[0];
  const second: unknown = value[1];
  if (typeof first === 'number' && typeof second === 'number') return [[first, second]];
  return value.flatMap(positions);
};

const container = document.getElementById(MAP_ELEMENT);
const holder = document.getElementById(FEATURES_ELEMENT);
const data: unknown = JSON.parse(holder?.textContent ?? 'null');
const features = isRecord(data) && Array.isArray(data['features']) ? data['features'] : [];

if (container !== null) {
  const style: StyleSpecification = {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [TILES],
        tileSize: 256,
        maxzoom: 19,
        attribution: ATTRIBUTION,
      },
      entities: { type: 'geojson', data: { type: 'FeatureCollection', features } },
    },
    layers: [
      { id: 'ground', type: 'background', paint: { 'background-color': GROUND } },
      { id: 'basemap', type: 'raster', source: 'basemap' },
      {
        id: 'areas',
        type: 'fill',
        source: 'entities',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': MARK, 'fill-opacity': 0.3, 'fill-outline-color': MARK },
      },
      {
        id: 'lines',
        type: 'line',
        source: 'entities',
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: { 'line-color': MARK, 'line-width': 2 },
      },
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
    ],
  };
  const map = new MapLibre({ container, style, center: [0, 30], zoom: 1 });
  // The page can change width after the map starts, for example when a scroll bar comes, and
  // MapLibre follows only the window.
  new ResizeObserver(() => {
    map.resize();
  }).observe(container);

  const all = features.flatMap((one: unknown) =>
    isRecord(one) && isRecord(one['geometry']) ? positions(one['geometry']['coordinates']) : [],
  );
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

  // The card is built from text nodes, because a label comes from an untrusted page.
  const holderOfCards = document.getElementById(CARDS_ELEMENT);
  const cards: unknown = JSON.parse(holderOfCards?.textContent ?? 'null');
  const cardBox = document.getElementById(CARD_ELEMENT);
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  const element = (tag: string, content: string): HTMLElement => {
    const one = document.createElement(tag);
    one.textContent = content;
    return one;
  };
  const link = (href: string, label: string): HTMLAnchorElement => {
    const one = document.createElement('a');
    one.href = href;
    one.textContent = label;
    one.className = 'underline';
    return one;
  };
  const showCard = (id: string): void => {
    const card = isRecord(cards) ? cards[id] : undefined;
    if (cardBox === null || !isRecord(card)) return;
    const body: HTMLElement[] = [];
    const title = element('h2', '');
    title.className = 'font-medium';
    title.append(link(text(card['href']), text(card['label'])));
    body.push(title);
    body.push(element('p', [text(card['type']), text(card['stage'])].filter(Boolean).join(', ')));
    const values = Array.isArray(card['values']) ? card['values'] : [];
    const relations = Array.isArray(card['relations']) ? card['relations'] : [];
    const list = (heading: string, items: HTMLElement[]): void => {
      if (items.length === 0) return;
      const section = element('h3', heading);
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
  for (const layer of ['points', 'lines', 'areas'])
    map.on('click', layer, (event) => {
      const [hit] = event.features ?? [];
      if (hit === undefined) return;
      const properties: Record<string, unknown> = hit.properties;
      showCard(text(properties['id']));
    });
}
