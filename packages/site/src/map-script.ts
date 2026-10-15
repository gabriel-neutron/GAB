import { Map as MapLibre, type StyleSpecification } from 'maplibre-gl';

import { CARD_ELEMENT, CARDS_ELEMENT, FEATURES_ELEMENT, MAP_ELEMENT } from './map-elements.ts';

// External constraint: MapLibre parses no oklch colour, so the map takes the hex of the muted
// ground of the light theme.
const GROUND = '#eceef0';
const MARK = '#0b6aa2';

// The basemap is a file of the site: the outlines of the countries, from Natural Earth (public
// domain). The site sends no request to a tile server (ADR 0020).
const COUNTRIES = new URL('./countries.json', import.meta.url).href;
const LAND = '#ffffff';
const COAST = '#9aa0a6';

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
      countries: { type: 'geojson', data: COUNTRIES },
      entities: { type: 'geojson', data: { type: 'FeatureCollection', features } },
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

  // The page renders each card in a hidden holder, so the script only copies the selected one.
  const holderOfCards = document.getElementById(CARDS_ELEMENT);
  const cardBox = document.getElementById(CARD_ELEMENT);
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  const showCard = (id: string): void => {
    const card = [...(holderOfCards?.children ?? [])].find(
      (one) => one instanceof HTMLElement && one.dataset['card'] === id,
    );
    if (cardBox === null || card === undefined) return;
    cardBox.replaceChildren(...[...card.childNodes].map((one) => one.cloneNode(true)));
  };
  for (const layer of ['points', 'lines', 'areas'])
    map.on('click', layer, (event) => {
      const [hit] = event.features ?? [];
      if (hit === undefined) return;
      const properties: Record<string, unknown> = hit.properties;
      showCard(text(properties['id']));
    });
}
