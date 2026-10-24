# ADR 0005 — Cartographic library and tile path

**Status** Accepted · 10 August 2026 · **Amended 17 August and 13 October 2026**
**Narrowed 18 October 2026** by ADR 0028: the map of the application is the globe of the release. It draws the outlines of the countries from a file of the bundle, and it sends no request to a tile server. The plan ground, the imagery and the tile path below applied again on 24 October 2026 (ADR 0028, section "The map"): the one map of the site has the plan and satellite grounds again, and its tile requests are the bounded exception that ADR names. The choice of `maplibre-gl`, with no wrapper, stays.
**Replaces** an earlier entry of `decisions.md` that deferred the cartographic library and the tile path.

Two operator constraints control this decision: no paid third-party service, and the region of work
is Russia.

## MapLibre GL JS

The map draws all entities on the GPU, and it shows raster and vector data in one stack. Leaflet
fails at a much lower marker count. OpenLayers has the best editing tools, but this ADR removes
editing from the scope. We use `maplibre-gl` directly, with no wrapper (ADR 0004).

## The plan ground

The application must work with no configuration. Thus the plan ground reads a hosted tile address
from configuration first. When there is no address, it uses the OpenStreetMap Foundation tile
servers.

A hosted archive is an optimisation, not a condition to run. When we host one, it is a PMTiles
archive in the S3 store (ADR 0007), in a second, public bucket. The raw bucket stays private, so
`spec.md` T3 does not change: a basemap is not raw material and not evidence. The archive is
tiered, because the operator refused a full-country file at high zoom: the world at low zoom, each
country with entities at middle zoom, and a buffer around each entity at high zoom. Before the first
archive is served, the store must prove that it supports range requests and entity tags.

## Imagery

| Layer | Source | Obligation |
|---|---|---|
| Plan | A hosted archive, or the OpenStreetMap Foundation tile servers | ODbL attribution |
| Satellite | EOX Sentinel-2 cloudless: no key, global, uniform over Russia | CC BY-NC-SA attribution |
| Dated overlay | NASA GIBS: no key, public domain in practice | The published acknowledgement |

**Google is refused.** Its terms forbid tile use outside its own client, and they forbid object
detection by name, which is the main work of this system.

**Yandex is refused.** Its free endpoint is scraping, and its licence needs a Russian commercial
contract. Also, the operator does not trust a Russian provider to study Russian sensitive areas.

**We accept the non-commercial condition of the EOX imagery.** Gabriel must stay non-commercial
while it uses that layer. If this condition becomes a problem, an older EOX layer has a plain CC BY
licence.

## No geometry editor, and a geographic file only through a mapping

The analyst creates geographic elements (`prd.md`). We keep three acts and cut one:

- **Kept:** place a point by a click or by typed coordinates.
- **Kept:** parametric geometry, such as a typed buffer radius. A report can defend it.
- **Kept:** temporary measurement of distance, bearing and area.
- **Cut:** vertex authoring, such as tracing a footprint.

Analysts already have better tools to trace geometry, and a polygon drawn by hand has no source
(`decisions.md` M8). A box selection stays, as a query control only, never as stored geometry.

**Amended 13 October 2026.** A geographic file now enters, but only through a mapping (`decisions.md`
P5, P6). The text step reads a GeoJSON layer as a table, and the back-end AI maps its columns, so
the geometry has a source and passes the rules like any other fact. A vertex editor stays out.

**The path of a QGIS correction (13 October 2026).** The operator traces or corrects a geometry in
QGIS, and sends the result as an act `update_entity` that carries the GeoJSON geometry. This is an
act of the operator (`decisions.md` M8), so it is signed at once and no rule decides it. The act
cites the operator authority (`manual`) by default. It can instead cite a stored document, such as
a Sentinel-2 image, in `cites`. The promotion replaces the source list of the row with the
documents of the act (S2), and the prior value of the act keeps the old geometry, so the history
holds each position that the entity had. A load from a reference dataset uses the same act: it sets
a missing geometry, and a different geometry waits as a doubt (S3). Code never replaces a position
of the record in silence.

## Bought imagery and radar

No free global radar service exists, and `prd.md` puts radar processing out of scope. A radar
quicklook made outside Gabriel is a normal source document, with no map layer. A georeferenced file
made elsewhere, or a bought scene, is converted to a cloud-optimised GeoTIFF at ingest, kept in the
S3 store and shown as a raster layer above the ground. This needs no new server component.

## Layers

The layer panel is a projection of the entity types: one data source and many panel entries. One
real layer for each type would send one query for each type. A layer keeps its membership rule apart
from its style, because a mix of the two is the most frequent fault in tools of this class.

## Cost

- The OpenStreetMap tile policy permits casual, low-volume use only. It is not a tile service for
  an application. A public deployment must have a hosted plan ground first. The static site of a
  release has no plan ground (ADR 0020).
- A hosted archive must be refreshed: a job reads the entity geometries and writes the archive
  again.
- The non-commercial condition of the satellite imagery limits the project.
