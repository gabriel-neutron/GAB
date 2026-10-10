import { Map as MapLibre, Popup, type StyleSpecification } from 'maplibre-gl';

import { FEATURES_ELEMENT, MAP_ELEMENT } from './map-elements.ts';

// External constraint: MapLibre parses no oklch colour, so the map takes the hex of three tokens
// of the light theme: the muted ground, the edge of a control and the primary.
const GROUND = '#eceef0';
const LINE = '#8b9196';
const MARK = '#0b6aa2';

// A plain ground with lines every 10 degrees. A tile server would need a host or a key, and the
// site sends no request to a service.
const STEP = 10;

const graticule = () => {
  const lines: [number, number][][] = [];
  for (let lon = -180; lon <= 180; lon += STEP)
    lines.push([
      [lon, -85],
      [lon, 85],
    ]);
  for (let lat = -80; lat <= 80; lat += STEP)
    lines.push([
      [-180, lat],
      [180, lat],
    ]);
  return {
    type: 'FeatureCollection' as const,
    features: lines.map((coordinates) => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates },
    })),
  };
};

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
      graticule: { type: 'geojson', data: graticule() },
      entities: { type: 'geojson', data: { type: 'FeatureCollection', features } },
    },
    layers: [
      { id: 'ground', type: 'background', paint: { 'background-color': GROUND } },
      { id: 'graticule', type: 'line', source: 'graticule', paint: { 'line-color': LINE } },
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
          'circle-color': MARK,
          'circle-radius': 5,
          'circle-stroke-color': GROUND,
          'circle-stroke-width': 1,
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
      // Origin of the number: at zoom 4 the map shows about 20 degrees, so two lines of the
      // grid are in view also around one point.
      { padding: 60, maxZoom: 4, duration: 0 },
    );
  }

  // The popup is built from text nodes, because a label comes from an untrusted page.
  for (const layer of ['points', 'lines', 'areas'])
    map.on('click', layer, (event) => {
      const [hit] = event.features ?? [];
      if (hit === undefined) return;
      const properties: Record<string, unknown> = hit.properties;
      const id = typeof properties['id'] === 'string' ? properties['id'] : '';
      const label = typeof properties['label'] === 'string' ? properties['label'] : id;
      const body = document.createElement('div');
      const link = document.createElement('a');
      link.href = `../entity/${encodeURIComponent(id)}/index.html`;
      link.textContent = label;
      const type = document.createElement('p');
      type.textContent = typeof properties['type'] === 'string' ? properties['type'] : '';
      body.append(link, type);
      new Popup().setLngLat(event.lngLat).setDOMContent(body).addTo(map);
    });
}
