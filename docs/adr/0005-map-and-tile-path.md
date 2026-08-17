# ADR 0005 — Cartographic library and tile path

**Status** Accepted · 10 August 2026 · **§2 and §3 amended 17 August 2026**
**Replaces** **T8** in `docs/decisions.md`, which deferred the cartographic library and the tile
path.

Two constraints of the operator shape everything: no paid third-party service, and the region of
work is Russia.

### 1. MapLibre GL JS

The client draws about 10k entities on the GPU, and carries raster and vector in one stack.
Leaflet's markers are DOM and canvas objects and die well below that count. OpenLayers has the
strongest editing tools, and §4 removes editing from scope.

In MapLibre a **layer is a first-class object of the library**, so the `layers` table stores
something the renderer reads almost directly. `maplibre-gl` is driven directly — ADR 0004 §2.

### 2. A tiered, entity-driven PMTiles coverage, self-hosted on MinIO

**Amended 17 August 2026: this archive is an optimisation, and never a condition of running.** The
operator ruled that the application must work with no configuration at all, and that a hosted
archive is added later for performance. §3 holds what runs in its absence.

Measured against the Protomaps daily planet build: Russia is 13 GB at zoom 15, 6.8 GB at 14 and
3.7 GB at 13, using the real boundary polygon. A bounding box doubles those figures. The operator
refused a whole-country file, so the coverage is **tiered**: the world at low zoom so no area is
ever blank, Russia and any country holding entities at middle zoom, and buffered areas around
entities at zoom 15. **The breakpoints and the buffer radius are parameters to calibrate.**

The archive is served from MinIO, in a **second, public bucket**. The raw bucket stays private, so
T3 is untouched: a basemap is neither raw material nor evidence. MinIO satisfies PMTiles with no
configuration — range requests and `ETag` are there by default, and the client sends only a
CORS-safelisted header. **`mc cors set` is a dummy call in the community build.**

### 3. Imagery

| Layer | Source | Obligation |
|---|---|---|
| Plan | A hosted archive when one is configured, and **the OpenStreetMap Foundation tile servers otherwise** | ODbL. `© OpenStreetMap contributors` |
| Satellite | **EOX Sentinel-2 cloudless 2025** — keyless, 10 m, global, uniform over Russia | **CC BY-NC-SA 4.0.** `EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025)` |
| Dated overlay | **NASA GIBS** — keyless, effectively public domain | The published acknowledgement wording |

**The fallback is the amendment of 17 August 2026.** This ADR previously named the self-hosted
archive as the only source of the plan ground. The operator ruled that the application must run
with none, so the address is read from configuration first and falls back to the public servers.
**#73 holds what must be true before any deployment**: that policy is for casual and low-volume
use, and it is not a tile service for an application.

**Google is refused.** Its terms forbid tile use outside its own client, and its Map Tiles policies
forbid object detection by name — which is the core work of this system.

**Yandex is refused.** Its keyless endpoint is its own client's, so using it is scraping, and the
licensed route needs a Russian commercial relationship. The operator's reason is trust: a Russian
provider cannot be relied on to study Russian sensitive areas.

**The non-commercial condition is accepted as the price of the imagery.** Gabriel must stay
non-commercial while that layer is used. The reach of its ShareAlike term is **not settled**. The
fallback is the 2016 EOX layer, which is plain CC BY with older imagery.

**The two tile ceilings are measured, on 17 August 2026.** The OpenStreetMap servers answer at
zoom 19 and refuse zoom 20. The EOX service never returns nothing: it upsamples past the 10 m
resolution of Sentinel-2. Each source therefore states its ceiling, MapLibre never asks past it,
and it draws the overzoomed parent tile itself. **The seam is deliberate on both grounds**, which
answers the one item this ADR said to check at build time.

### 4. No geometry editor, and no file import

`prd.md` §4.2 says the analyst creates geographic elements. That covers four acts, and only the
fourth is drawing.

| Act | Verdict |
|---|---|
| Place a point, by click or by typed coordinate | **Kept.** It is the geolocation result |
| Parametric geometry — a buffer radius, a view cone | **Kept.** A hand-traced circle is not defensible in a report; a typed 500 m is |
| Ephemeral measurement — distance, bearing, area | **Kept.** Nothing is stored |
| Vertex authoring — trace a footprint, snap, repair | **Cut** |

Analysts already own better tools for vertex authoring, and a hand-drawn polygon carries no source
in a system where every claim cites one (M8). **Geographic file import is also cut** from the first
build. A **box-select** survives as a **query control**, never as stored geometry.

**P6 is untouched.** The structured-file ingestion path is not removed; it is not built first.

### 5. Bought imagery and radar

There is no keyless global radar service, and raw Sentinel-1 needs a processing chain that `prd.md`
§5 puts out of scope.

Now: a readable radar quicklook, produced outside Gabriel, is attached as an ordinary **source
document**. No map layer. Later: a georeferenced file prepared elsewhere is displayed through
`cog://`. Bought scenes take the same path — one `gdal_translate -of COG` at ingest, the archive in
MinIO, and a raster layer above the ground. **No new server component.**

### 6. What `layers` becomes

- **`kind='drawn'` disappears**, with the editor.
- **One data source, many presentation entries.** A panel entry per entity type is the right
  ergonomics; thirty real layers would mean thirty queries from a browser. The panel is a
  projection of the type list, generated by the machine.
- **The `definition` and `style` split is kept.** `definition` decides membership; `style` decides
  appearance. Confusing the two is the most common fault in tools of this class.
- `kind='query'` stays, as the escape hatch for a layer that is not "by type".

## Consequences

- The map works on the operator's machine only. A public map needs a deployment, which does not
  exist, and **#73 gates it**.
- Refreshing the coverage of §2 is a job that reads entity geometries and rewrites an archive.
- The non-commercial condition of §3 now constrains the project.
