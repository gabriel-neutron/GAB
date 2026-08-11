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
 * ADR 0005 §2 settles the tile path: a tiered PMTiles archive of the OpenStreetMap build,
 * self-hosted in a public MinIO bucket. **That archive does not exist**, because building it is
 * write-side work that no code does yet.
 *
 * Two basemaps are therefore drawn, and only one of them is the decision:
 *
 * | Layer | Source | Standing |
 * |---|---|---|
 * | Satellite | EOX Sentinel-2 cloudless 2025 | **The decision.** ADR 0005 §3, keyless, already chosen |
 * | Map | The raster tiles of the OpenStreetMap Foundation | **A stand-in. It must never ship** |
 *
 * **The map view is not the tile path of ADR 0005 §2, and it must not be read as one.** It is
 * the same data under the same obligation — ODbL, and §3 already names that obligation for the
 * basemap — served the wrong way: from the tiles of the OpenStreetMap Foundation instead of
 * from a PMTiles archive on MinIO. It exists so that the operator can judge a basemap against
 * imagery **before** the archive is built. The build is local and has one user, which is the
 * only reason it is defensible at all; a deployment would breach the tile usage policy of that
 * service. **No ticket holds this yet, and one must before anything is deployed.**
 *
 * The consequence named in ADR 0005 — whether MapLibre draws the blurry parent tile or nothing
 * where a high-zoom tile is missing — is visible on the satellite layer: EOX stops at zoom 14,
 * so zooming past it shows the answer. The stand-in serves to zoom 19, which is why the two do
 * not behave alike at a berth.
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
  byLinkFid,
  entityTypes,
  geoEntities,
  geoLinks,
  linksOf,
  type GeoEntity,
  type GeoLink,
} from './prototype-corpus';
import { patchMapWorkspace, readMapWorkspace, type Basemap } from './prototype-workspace';

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

/** ODbL. ADR 0005 §3 fixes this obligation for the basemap, whoever serves the tiles. */
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

const BASEMAP_LAYERS: Readonly<Record<Basemap, string>> = {
  satellite: 'basemap-satellite',
  osm: 'basemap-osm',
};

const layerIdOf = (type: string): string => `entities-${type}`;

// ------------------------------------------------------------------------------------------

export interface MapHandle {
  /** Use case 1: the camera goes to one entity. */
  readonly flyTo: (entity: GeoEntity) => void;
  readonly fitAll: () => void;
  /** ADR 0005 §3 draws both, and #33 calls the choice workspace and not identity. */
  readonly setBasemap: (basemap: Basemap) => void;
  readonly basemap: () => Basemap;
  /** Use case 2: the layer panel and the type filter are one control. */
  readonly setTypeVisible: (type: string, visible: boolean) => void;
  readonly isTypeVisible: (type: string) => boolean;
  /** The relations whose two endpoints carry a geometry. M4 relations are not drawable. */
  readonly setLinksVisible: (visible: boolean) => void;
  readonly linksVisible: () => boolean;
  readonly selectLink: (link: GeoLink | null) => void;
  readonly selectedLink: () => GeoLink | null;
  readonly onLinkSelect: (listener: (link: GeoLink | null) => void) => void;
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

function lineCollection(list: readonly GeoLink[]) {
  return {
    type: 'FeatureCollection' as const,
    features: list.map((link) => ({
      type: 'Feature' as const,
      id: link.fid,
      properties: { type: link.type },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [link.from.lon, link.from.lat],
          [link.to.lon, link.to.lat],
        ],
      },
    })),
  };
}

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

function buildStyle(colourOf: (type: string) => string, basemap: Basemap): StyleSpec {
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
      osm: {
        type: 'raster',
        tiles: [OSM_TILES],
        tileSize: 256,
        maxzoom: 19,
        attribution: OSM_ATTRIBUTION,
      },
      entities: { type: 'geojson', data: collection(geoEntities) },
      links: { type: 'geojson', data: lineCollection(geoLinks) },
      // The links of the selected entity, and the one link the operator opened. Each is a
      // small source of its own, for the same reason as the halos below.
      'links-active': { type: 'geojson', data: lineCollection([]) },
      'links-chosen': { type: 'geojson', data: lineCollection([]) },
      // The halo of the selection and the halo of the cursor are their own sources, each
      // holding nought or one feature. Setting the data of a small source is cheaper to read
      // than an expression over feature state, and this is throwaway code.
      selected: { type: 'geojson', data: collection([]) },
      hovered: { type: 'geojson', data: collection([]) },
    },
    layers: [
      // Both basemaps live in the style and one of them is hidden, so a change is a layout
      // property and never a rebuilt style. A rebuilt style drops every source with it, and
      // the selection and the hidden types would have to be applied again.
      {
        id: BASEMAP_LAYERS.satellite,
        type: 'raster',
        source: 'satellite',
        layout: { visibility: basemap === 'satellite' ? 'visible' : 'none' },
      },
      {
        id: BASEMAP_LAYERS.osm,
        type: 'raster',
        source: 'osm',
        layout: { visibility: basemap === 'osm' ? 'visible' : 'none' },
      },
      // Lines below every point, so a relation never covers the thing it relates.
      {
        id: 'links-line',
        type: 'line',
        source: 'links',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': 'rgba(255,255,255,0.55)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.6, 8, 1.2, 14, 2],
        },
      },
      {
        id: 'links-active-line',
        type: 'line',
        source: 'links-active',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 1.4, 8, 2.4, 14, 3.5],
        },
      },
      {
        id: 'links-chosen-line',
        type: 'line',
        source: 'links-chosen',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 2, 3, 8, 5, 14, 7],
          'line-opacity': 0.35,
        },
      },
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
        // The ring marks the selected point. It follows the radius of the points below it with
        // a constant gap, and it has **no fill**: a fixed 18px disc looked like a grey blob at
        // low zoom and enclosed whatever stood near, so it read as "these two" and not
        // "this one".
        id: 'selected-ring',
        type: 'circle',
        source: 'selected',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 7, 8, 10, 14, 15],
          'circle-color': 'rgba(0,0,0,0)',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      },
      ...entityTypes.map((type) => layerOfType(type, colourOf(type))),
    ],
  };
}

/**
 * `attributionCorner` is a parameter and not a constant because a bar that floats over the map
 * covers whichever corner it stands in. The wording of ADR 0005 §3 is an obligation of the
 * licence, so a bar that hides it must move it rather than accept it.
 */
export function mountMap(
  host: HTMLElement,
  colourOf: (type: string) => string,
  attributionCorner: 'bottom-left' | 'bottom-right' = 'bottom-left',
): MapHandle {
  const saved = readMapWorkspace();
  const hidden = new Set(saved.hidden.filter((type) => typeof type === 'string'));

  const map = new MapLibreMap({
    container: host,
    style: buildStyle(colourOf, saved.basemap),
    center: [saved.lon, saved.lat],
    zoom: saved.zoom,
    // Placed by hand, so that each bar can put it where its own chrome does not reach.
    attributionControl: false,
    // The prototype is judged on the chrome each variant adds, so the library adds none of
    // its own beyond the attribution the licence requires.
    dragRotate: false,
  });

  map.addControl(new AttributionControl({ compact: false }), attributionCorner);

  /**
   * `setLayoutProperty` throws while the style is still loading, and a control can be clicked
   * in that window. One queue, drained on `load`, for every caller that touches a layout
   * property. Without it the basemap button is dead for the first second and says nothing.
   */
  let styleReady = false;
  const pending: (() => void)[] = [];

  const whenStyleReady = (task: () => void): void => {
    if (styleReady) task();
    else pending.push(task);
  };

  let basemap: Basemap = saved.basemap;
  let selection: GeoEntity | null = null;
  let chosenLink: GeoLink | null = null;
  let linksOn = true;
  const linkListeners: ((link: GeoLink | null) => void)[] = [];
  const selectListeners: ((entity: GeoEntity | null) => void)[] = [];
  const hoverListeners: ((entity: GeoEntity | null, x: number, y: number) => void)[] = [];
  const cursorListeners: ((lon: number, lat: number, zoom: number) => void)[] = [];

  const setLinkData = (id: string, list: readonly GeoLink[]): void => {
    const source = map.getSource(id);
    if (source instanceof GeoJSONSource) void source.setData(lineCollection(list));
  };

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
      basemap,
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
    // Every link of the selected entity, brightened. This is the answer to "what does this one
    // touch", and it needs no click.
    setLinkData('links-active', entity === null ? [] : linksOf(entity.id));
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
    map.getCanvas().style.cursor = entity !== null || linkAt(event) !== null ? 'pointer' : '';
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

  /**
   * A line is one or two pixels wide, so a click on it needs a tolerance that a point does not.
   * The box is 5px on each side of the pointer.
   */
  const linkAt = (event: MapMouseEvent): GeoLink | null => {
    if (!linksOn) return null;
    const { x, y } = event.point;
    const [feature] = map.queryRenderedFeatures(
      [
        [x - 5, y - 5],
        [x + 5, y + 5],
      ],
      { layers: ['links-line', 'links-active-line'] },
    );
    if (feature === undefined || typeof feature.id !== 'number') return null;
    return byLinkFid.get(feature.id) ?? null;
  };

  const applyLink = (link: GeoLink | null): void => {
    chosenLink = link;
    setLinkData('links-chosen', link === null ? [] : [link]);
    for (const listener of linkListeners) listener(link);
  };

  /**
   * One handler, and it decides for itself what is under the pointer, so nothing depends on the
   * order two handlers would run in. A point wins over a line it crosses, because the point is
   * the smaller target and the one the analyst aimed at.
   */
  map.on('click', (event) => {
    const entity = entityAt(event);
    if (entity !== null) {
      applyLink(null);
      applySelection(entity);
      return;
    }

    const link = linkAt(event);
    if (link !== null) {
      applyLink(link);
      return;
    }

    applyLink(null);
    applySelection(null);
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

  /**
   * Dark mode, without a fourth imagery source.
   *
   * The OpenStreetMap wiki lists no dark style on the servers of the Foundation, and every dark
   * raster provider it names wants a registration or a key. So the basemap is darkened in the
   * shader instead: `raster-brightness-min: 1` with `raster-brightness-max: 0` inverts the
   * luminance of the layer, and a half turn of hue puts the water back to blue. It applies to
   * the **raster layer only**, so the entity hues and the lines above it are untouched — which
   * a CSS filter over the canvas could not do.
   *
   * It is not a designed dark cartography. The real one comes with the vector basemap of ADR
   * 0005 §2, whose themes include a dark one.
   *
   * The theme lives on the class of `documentElement`, written by `shared/theme-provider`. The
   * map reads it from the DOM and never from React, per ADR 0004 §3.
   */
  const applyTheme = (): void => {
    const dark = document.documentElement.classList.contains('dark');
    whenStyleReady(() => {
      map.setPaintProperty(BASEMAP_LAYERS.osm, 'raster-brightness-min', dark ? 1 : 0);
      map.setPaintProperty(BASEMAP_LAYERS.osm, 'raster-brightness-max', dark ? 0 : 1);
      map.setPaintProperty(BASEMAP_LAYERS.osm, 'raster-hue-rotate', dark ? 180 : 0);
      map.setPaintProperty(BASEMAP_LAYERS.osm, 'raster-saturation', dark ? -0.2 : 0);
      // Imagery is already dark. It only wants taking down a little, never inverting.
      map.setPaintProperty(BASEMAP_LAYERS.satellite, 'raster-brightness-max', dark ? 0.82 : 1);
    });
  };

  const themeWatch = new MutationObserver(applyTheme);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  applyTheme();

  // The style is built with every entity layer visible, so the saved workspace is applied once
  // the style is loaded.
  map.on('load', () => {
    styleReady = true;
    for (const type of hidden) map.setLayoutProperty(layerIdOf(type), 'visibility', 'none');

    // The selection restored from the address is applied in the constructor, before a source
    // exists to draw it on: `getSource` returns nothing until the style is loaded, and it
    // returns it silently. Without this line the rail marks the row, the sidebar reads the
    // entity, and the map alone shows no ring.
    setSourceData('selected', selection === null ? [] : [selection]);

    for (const task of pending.splice(0)) task();
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
      whenStyleReady(() => {
        map.setLayoutProperty(layerIdOf(type), 'visibility', visible ? 'visible' : 'none');
      });

      // A hidden type must not keep a selection or a halo on the screen.
      if (!visible && selection !== null && selection.type === type) applySelection(null);
      persist();
    },

    setBasemap: (next) => {
      basemap = next;
      whenStyleReady(() => {
        for (const key of ['satellite', 'osm'] as const) {
          map.setLayoutProperty(
            BASEMAP_LAYERS[key],
            'visibility',
            key === basemap ? 'visible' : 'none',
          );
        }
      });
      persist();
    },

    basemap: () => basemap,

    setLinksVisible: (visible) => {
      linksOn = visible;
      whenStyleReady(() => {
        for (const id of ['links-line', 'links-active-line', 'links-chosen-line']) {
          map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }
      });
      if (!visible) applyLink(null);
    },

    linksVisible: () => linksOn,
    selectLink: applyLink,
    selectedLink: () => chosenLink,
    onLinkSelect: (listener) => linkListeners.push(listener),

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
      themeWatch.disconnect();
      // `remove` releases the WebGL context and every listener registered above. Without it the
      // second invocation of the effect in development leaves the first map alive and the
      // browser drops the oldest context, which looks like a blank map and is not one.
      map.remove();
    },
  };
}
