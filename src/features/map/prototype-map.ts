/**
 * PROTOTYPE — throwaway. The imperative adapter of ADR 0004 §3.
 *
 * One MapLibre instance, driven directly. No binding: ADR 0004 §2 refuses `react-map-gl`.
 * Nothing here is React, nothing here re-renders, and `mount` is idempotent, because React 19
 * double-invokes an effect in development and a non-idempotent mount makes two maps.
 *
 * ------------------------------------------------------------------------------------------
 * The imagery, and what this prototype does **not** settle
 * ------------------------------------------------------------------------------------------
 *
 * ADR 0005 §2 settles the tile path: a tiered PMTiles archive, self-hosted in a public MinIO
 * bucket. **That archive does not exist**, because building it is write-side work that no code
 * does yet. So the basemap of this prototype is the **satellite layer of ADR 0005 §3** — EOX
 * Sentinel-2 cloudless 2025, keyless, already chosen, already carrying its attribution. No new
 * imagery source is introduced here, and the vector basemap is absent, not replaced.
 *
 * The consequence named in ADR 0005 — whether MapLibre draws the blurry parent tile or nothing
 * where a high-zoom tile is missing — is visible in this prototype: the EOX layer stops at zoom
 * 14, so zooming past it shows the answer.
 */

import {
  AttributionControl,
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  type MapMouseEvent,
  type MapOptions,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  boundsOfAll,
  byFid,
  byId,
  entityTypes,
  geoEntities,
  type GeoEntity,
} from './prototype-corpus';
import { patchMapWorkspace, readMapWorkspace } from './prototype-workspace';

/**
 * The map publishes its selection on `window`, and the **route** listens. A feature never
 * imports a feature (ADR 0004 §5), so the map cannot hand the selection to the detail sidebar
 * itself. Declaring the event here types both ends and keeps `any` out of the listener.
 *
 * This is prototype scaffolding. The seam of ADR 0004 §5 is meant to carry the selection, and
 * it is not written yet.
 */
declare global {
  interface WindowEventMap {
    'gab:map-selection': CustomEvent<string | null>;
  }
}

/** ADR 0005 §3 fixes this wording. It is an obligation of the licence, not a caption. */
const EOX_ATTRIBUTION =
  'EOxCloudless <a href="https://cloudless.eox.at">https://cloudless.eox.at</a> by EOX IT ' +
  'Services GmbH (Contains modified Copernicus Sentinel data 2025)';

const EOX_TILES =
  'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg';

const layerIdOf = (type: string): string => `entities-${type}`;

// ------------------------------------------------------------------------------------------

export interface MapHandle {
  /** Use case 1: the camera goes to one entity. */
  readonly flyTo: (entity: GeoEntity) => void;
  readonly fitAll: () => void;
  /** Use case 2: the layer panel and the type filter are one control. */
  readonly setTypeVisible: (type: string, visible: boolean) => void;
  readonly isTypeVisible: (type: string) => boolean;
  /** Use case 4: the selection is the only output of the map. */
  readonly select: (entity: GeoEntity | null) => void;
  readonly selected: () => GeoEntity | null;
  readonly onSelect: (listener: (entity: GeoEntity | null) => void) => void;
  /** Use case 3: what is under the cursor, before anything is committed to. */
  readonly onHover: (listener: (entity: GeoEntity | null, x: number, y: number) => void) => void;
  readonly onCursor: (listener: (lon: number, lat: number, zoom: number) => void) => void;
  readonly destroy: () => void;
}

/**
 * `maplibre-gl` v6 re-exports neither `StyleSpecification` nor `LayerSpecification`, and the
 * package that declares them is not a direct dependency. `MapOptions` **is** exported, so both
 * types are reached through it and no dependency is added for a prototype.
 */
type StyleSpec = Exclude<MapOptions['style'], string | undefined>;
type LayerSpec = StyleSpec['layers'][number];

function collection(list: readonly GeoEntity[]) {
  return {
    type: 'FeatureCollection' as const,
    features: list.map((entity) => ({
      type: 'Feature' as const,
      id: entity.fid,
      properties: { type: entity.type },
      geometry: { type: 'Point' as const, coordinates: [entity.lon, entity.lat] },
    })),
  };
}

/**
 * One circle layer per type, over **one** data source.
 *
 * ADR 0005 §6 asks for exactly this shape: one data source, many presentation entries, so that
 * a panel of thirty types is not thirty queries. A type is hidden with `visibility`, which is a
 * layout property of the layer and needs no new data.
 */
function layerOfType(type: string, colour: string): LayerSpec {
  return {
    id: layerIdOf(type),
    type: 'circle',
    source: 'entities',
    filter: ['==', ['get', 'type'], type],
    paint: {
      // A point stays legible from the world view to a berth.
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 3.5, 8, 6, 14, 10],
      'circle-color': colour,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(10,10,10,0.85)',
    },
  };
}

function buildStyle(colourOf: (type: string) => string): StyleSpec {
  return {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [EOX_TILES],
        tileSize: 256,
        // EOX serves this layer to zoom 14. Past it MapLibre overzooms the last tile, which is
        // the behaviour ADR 0005 says to check at build time rather than assume.
        maxzoom: 14,
        attribution: EOX_ATTRIBUTION,
      },
      entities: { type: 'geojson', data: collection(geoEntities) },
      // The halo of the selection and the halo of the cursor are their own sources, each
      // holding nought or one feature. Setting the data of a small source is cheaper to read
      // than an expression over feature state, and this is throwaway code.
      selected: { type: 'geojson', data: collection([]) },
      hovered: { type: 'geojson', data: collection([]) },
    },
    layers: [
      { id: 'satellite', type: 'raster', source: 'satellite' },
      {
        id: 'hovered-ring',
        type: 'circle',
        source: 'hovered',
        paint: {
          'circle-radius': 13,
          'circle-color': 'rgba(255,255,255,0.12)',
          'circle-stroke-width': 1,
          'circle-stroke-color': 'rgba(255,255,255,0.7)',
        },
      },
      {
        id: 'selected-ring',
        type: 'circle',
        source: 'selected',
        paint: {
          'circle-radius': 18,
          'circle-color': 'rgba(255,255,255,0.06)',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      },
      ...entityTypes.map((type) => layerOfType(type, colourOf(type))),
    ],
  };
}

export function mountMap(host: HTMLElement, colourOf: (type: string) => string): MapHandle {
  const saved = readMapWorkspace();
  const hidden = new Set(saved.hidden.filter((type) => typeof type === 'string'));

  const map = new MapLibreMap({
    container: host,
    style: buildStyle(colourOf),
    center: [saved.lon, saved.lat],
    zoom: saved.zoom,
    // Placed by hand, and not left at the default. The default corner is bottom right, where
    // the floating switcher of the prototype covers the first words of it. The wording of
    // ADR 0005 §3 is an obligation of the licence, so it must stay readable.
    attributionControl: false,
    // The prototype is judged on the chrome each variant adds, so the library adds none of
    // its own beyond the attribution the licence requires.
    dragRotate: false,
  });

  map.addControl(new AttributionControl({ compact: false }), 'bottom-left');

  let selection: GeoEntity | null = null;
  const selectListeners: ((entity: GeoEntity | null) => void)[] = [];
  const hoverListeners: ((entity: GeoEntity | null, x: number, y: number) => void)[] = [];
  const cursorListeners: ((lon: number, lat: number, zoom: number) => void)[] = [];

  const setSourceData = (id: string, list: readonly GeoEntity[]): void => {
    const source = map.getSource(id);
    // `setData` resolves when the worker has re-tiled. Nothing here waits for it, and a
    // rejection would be a broken source and not a case the prototype handles.
    if (source instanceof GeoJSONSource) void source.setData(collection(list));
  };

  const persist = (): void => {
    const centre = map.getCenter();
    patchMapWorkspace({
      lon: centre.lng,
      lat: centre.lat,
      zoom: map.getZoom(),
      hidden: [...hidden],
    });
  };

  /**
   * The layers a query may read. A hidden layer returns nothing from `queryRenderedFeatures`,
   * so a hidden type cannot be hovered or clicked and no separate guard is needed.
   */
  const visibleLayerIds = (): string[] =>
    entityTypes.filter((type) => !hidden.has(type)).map(layerIdOf);

  const entityAt = (event: MapMouseEvent): GeoEntity | null => {
    const ids = visibleLayerIds();
    if (ids.length === 0) return null;
    const [feature] = map.queryRenderedFeatures(event.point, { layers: ids });
    if (feature === undefined || typeof feature.id !== 'number') return null;
    return byFid.get(feature.id) ?? null;
  };

  /**
   * `notify` is false in exactly one place: the restore at mount. The route put the identifier
   * in the address, so telling the route about it again would be an echo.
   */
  const applySelection = (entity: GeoEntity | null, notify = true): void => {
    selection = entity;
    setSourceData('selected', entity === null ? [] : [entity]);
    for (const listener of selectListeners) listener(entity);

    if (notify) {
      window.dispatchEvent(
        new CustomEvent('gab:map-selection', { detail: entity === null ? null : entity.id }),
      );
    }
  };

  /**
   * Use case 5: the address names the selected entity, so a reload lands on it again. The map
   * reads the address once, at mount, and is the only writer afterwards. A two-way binding
   * between a live canvas and a router is a loop, and a prototype does not need one.
   */
  const restored = byId.get(new URLSearchParams(window.location.search).get('entity') ?? '');
  if (restored !== undefined) applySelection(restored, false);

  map.on('mousemove', (event) => {
    const entity = entityAt(event);
    map.getCanvas().style.cursor = entity === null ? '' : 'pointer';
    setSourceData('hovered', entity === null ? [] : [entity]);
    for (const listener of hoverListeners) listener(entity, event.point.x, event.point.y);
    for (const listener of cursorListeners) {
      listener(event.lngLat.lng, event.lngLat.lat, map.getZoom());
    }
  });

  map.on('mouseout', () => {
    setSourceData('hovered', []);
    for (const listener of hoverListeners) listener(null, 0, 0);
  });

  // A click on empty water clears the selection. One handler, and it decides for itself what is
  // under the pointer, so nothing depends on the order two handlers would run in.
  map.on('click', (event) => {
    applySelection(entityAt(event));
  });

  map.on('moveend', persist);

  /**
   * MapLibre measures the container once, in the constructor. Every variant builds its chrome
   * around the map, so the container is still growing at that moment, and the canvas keeps the
   * first height it saw — measured at 1140 by 97 in a container of 1140 by 839. Nothing warns:
   * the map draws correctly inside a canvas of the wrong size.
   *
   * The observer is the whole fix, and it also covers a window resize.
   */
  const resizeWatch = new ResizeObserver(() => {
    map.resize();
  });
  resizeWatch.observe(host);

  // The style is built with every layer visible, so the saved workspace is applied once the
  // style is loaded. `setLayoutProperty` before that point throws.
  map.on('load', () => {
    for (const type of hidden) map.setLayoutProperty(layerIdOf(type), 'visibility', 'none');
  });

  return {
    flyTo: (entity) => {
      map.flyTo({
        center: [entity.lon, entity.lat],
        zoom: Math.max(map.getZoom(), 11),
        speed: 1.6,
      });
    },

    fitAll: () => {
      const [west, south, east, north] = boundsOfAll();
      map.fitBounds(new LngLatBounds([west, south], [east, north]), { padding: 80, duration: 500 });
    },

    setTypeVisible: (type, visible) => {
      if (visible) hidden.delete(type);
      else hidden.add(type);
      map.setLayoutProperty(layerIdOf(type), 'visibility', visible ? 'visible' : 'none');

      // A hidden type must not keep a selection or a halo on the screen.
      if (!visible && selection !== null && selection.type === type) applySelection(null);
      persist();
    },

    isTypeVisible: (type) => !hidden.has(type),
    select: (entity) => {
      applySelection(entity);
    },
    selected: () => selection,
    onSelect: (listener) => selectListeners.push(listener),
    onHover: (listener) => hoverListeners.push(listener),
    onCursor: (listener) => cursorListeners.push(listener),

    destroy: () => {
      resizeWatch.disconnect();
      // `remove` releases the WebGL context and every listener registered above. Without it the
      // second invocation of the effect in development leaves the first map alive and the
      // browser drops the oldest context, which looks like a blank map and is not one.
      map.remove();
    },
  };
}
