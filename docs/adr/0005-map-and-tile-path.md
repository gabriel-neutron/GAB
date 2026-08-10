# ADR 0005 — Cartographic library and tile path

**Status** Accepted · **Version** 1 · 10 August 2026
**Tickets** #4 (closed by this ADR), #36 layer panel, #32 the raw store, #31 (closed), #13
corpus migration, #29 structured mapping proposal
**Replaces** **T8** in `docs/decisions.md`, which deferred the cartographic library and the
tile path. T8 is answered, not contradicted. Its warning is honoured: the choice is made
**before** any rendering code exists.

## Context

T8 deferred the choice and stated that it prejudged nothing, because PostGIS constrains no
rendering path. `spec.md` §6 recorded it as open, and `schema.md` §13 marked the `layers` table
provisional until it closed.

`prd.md` §4.2 requires that the map is both an analysis surface and a presentation surface,
and that the analyst creates geographic elements and composes layers inside Gabriel. The
operator refined that requirement during the grilling of 10 August 2026, and §4 below records
what it now means.

Two constraints of the operator shape everything: no paid third-party service, and the region
of work is Russia.

## Decision

### 1. MapLibre GL JS

The client draws about 10k entities on the GPU, and carries raster and vector in one stack:
a vector basemap, satellite raster, dated overlays, and later a radar raster.

Leaflet fails the first requirement — its markers are DOM and canvas objects and they die well
below that count. OpenLayers has the strongest editing tools, and §4 removes editing from
scope, so its weight buys nothing.

The composition requirement decides the rest. In MapLibre a **layer is a first-class object of
the library**, so the `layers` table stores something the renderer reads almost directly,
rather than instructions the application must interpret.

`maplibre-gl` is driven directly. No binding — see ADR 0004 §2.

### 2. A tiered, entity-driven PMTiles coverage, self-hosted on MinIO

Measured against the Protomaps daily planet build on 8 August 2026: Russia is 13 GB at zoom
15, 6.8 GB at 14 and 3.7 GB at 13, using the real boundary polygon. A bounding box doubles
those figures, because the latitude band of Russia also holds Finland, Poland, Turkey,
Mongolia and Korea. The antimeridian needs no second extract.

The operator refused a whole-country file. The coverage is **tiered**:

| Band | Covers |
|---|---|
| Low zoom | The whole world, so no area is ever blank |
| Middle zoom | Russia, and any country holding entities |
| Zoom 15 | Buffered areas around entities |

The region polygon is generated in PostGIS from the entity geometries and given to
`pmtiles extract`. A scheduled job refreshes it as the corpus grows. **The zoom breakpoints
and the buffer radius are parameters to calibrate, like the confidence threshold. They are not
decided here.**

The archive is served from **MinIO**, in a **second, public bucket**. The raw bucket stays
private, per #31, so T3 is untouched — a basemap is neither raw material nor evidence.

MinIO satisfies PMTiles with no configuration: range requests are implemented and `ETag` is
exposed by default, and the client sends only a CORS-safelisted `range` header, so no
preflight is issued. **`mc cors set` is a dummy call in the community build and does nothing**;
the documented CORS commands belong to the paid product. Origin control is one environment
variable.

**The build is local.** MinIO binds to `127.0.0.1`, so no map is public today. Giving MinIO
this second job is a new argument on **#32**, which asks whether the raw store stays on MinIO.
It is recorded there, not settled here.

### 3. Imagery

| Layer | Source | Obligation |
|---|---|---|
| Basemap | The self-hosted OSM archive | ODbL. `© OpenStreetMap contributors` |
| Satellite | **EOX Sentinel-2 cloudless 2025** — keyless, 10 m, global, uniform over Russia | **CC BY-NC-SA 4.0.** `EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025)` |
| Dated overlay | **NASA GIBS** — keyless, effectively public domain | The published acknowledgement wording |

**Google is refused.** Its terms forbid tile use outside its own client, and the Map Tiles
policies forbid object detection by name — which is the core work of this system.

**Yandex is refused.** It has the best coverage of the region. The keyless endpoint is its own
client's, so using it is scraping; the licensed route needs a Russian commercial relationship
under Russian law. The operator's reason is trust: a Russian provider cannot be relied on to
study Russian sensitive areas.

**The non-commercial condition is accepted as the price of the imagery.** Gabriel must stay
non-commercial while that layer is used. Nothing in `prd.md` or `decisions.md` says it is, so
this ADR is the first place it is written. The ShareAlike term of that licence, and how far it
reaches into what a published map produces, is **not settled** — the operator accepted the
licence and asked for a recheck once the stack was fixed. The fallback, if either condition
cannot hold, is the 2016 EOX layer, which is plain CC BY with older imagery.

### 4. No geometry editor, and no file import

`prd.md` §4.2 says the analyst creates geographic elements. That sentence covers four
different acts, and only the fourth is drawing.

| Act | Verdict |
|---|---|
| Place a point, by click or by typed coordinate | **Kept.** It is the geolocation result, and it is not drawing. |
| Parametric geometry — a buffer radius is a typed number, a view cone is a bearing and an angle | **Kept.** A hand-traced circle is not defensible in a report; a typed 500 m is. |
| Ephemeral measurement — distance, bearing, area, read and discarded | **Kept.** Nothing is stored. |
| Vertex authoring — trace a footprint, snap, repair a self-intersection | **Cut.** |

Vertex authoring is cut because analysts already own better tools for it, and because a
hand-drawn polygon carries no source in a system where every claim cites one (M8).

The operator additionally removed **geographic file import** — KML, GeoJSON, GPX, shapefile —
from the first build. A **box-select** survives as a **query control**, never as stored
geometry.

**This requires `prd.md` §4.2 and W10 to be reworded.** Proposed: *the analyst creates
geographic elements by coordinate entry and by parameter; the tool provides no interactive
geometry editor and no geographic file import.*

**P6 is untouched.** The structured-file ingestion path is not removed; it is not built in the
first version. #29 stands, and the one-time conversion of the past corpus is #13 — a script
run once, not a feature.

### 5. Bought imagery and radar

There is no keyless global radar service, and raw Sentinel-1 needs a processing chain that
`prd.md` §5 puts out of scope (W11).

- Now: a readable radar quicklook, produced outside Gabriel, is attached as an ordinary
  **source document**. No map layer.
- Later: a georeferenced file the analyst prepared elsewhere is displayed through `cog://`.

Bought scenes take the same path: one `gdal_translate -of COG -co
TILING_SCHEME=GoogleMapsCompatible` at ingest, the archive in MinIO, and a `cog://` raster
layer above the basemap. **No new server component.** A raster server would be needed only to
reproject on the fly, to mosaic at request time, or to compute bands — none of which applies
to a bought, orthorectified scene.

### 6. What `layers` becomes

`spec.md` §3.13 asked what the provisional table changes to.

- **`kind='drawn'` disappears**, with the editor.
- **One data source, many presentation entries.** A panel entry per entity type is the right
  ergonomics; thirty real layers would mean thirty queries from a browser. The panel is a
  projection of the type list, generated by the machine. The operator never maintains thirty
  rows by hand.
- **The `definition` and `style` split is kept.** `definition` decides membership; `style`
  decides appearance. Confusing the two is the most common fault in tools of this class.
- `kind='query'` stays, as the escape hatch for a layer that is not "by type".

`schema.md` stays provisional. The real shape is written in the migration files.

## Consequences

- The map works on the operator's machine only. A public map needs a deployment, which does
  not exist — see #34.
- Refreshing the coverage is a job that reads entity geometries and rewrites an archive. It is
  new work on the write side, and no ticket held it before this ADR.
- The non-commercial condition of §3 now constrains the project. It must be revisited before
  any commercial use, and before publication under PU1 if ShareAlike proves to reach the
  output.
- One item must be checked at build time and not assumed: whether MapLibre draws the blurry
  parent tile, or nothing, where a high-zoom tile is absent. It decides whether the tiered
  seams look deliberate or broken.

## Not decided here

- **The zoom breakpoints and the buffer radius** — parameters, to be calibrated on real data.
- **What "edit" means in the layer panel** — #36, deferred to the map prototype.
- **Whether the raw store stays on MinIO** — #32, now with one more argument.
- **The ShareAlike reach of the imagery licence** — to be rechecked, per §3.
