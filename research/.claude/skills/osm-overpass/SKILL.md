---
name: osm-overpass
description: Find an OpenStreetMap object (a refinery, a port, a pipeline) and get its identifier or geometry without wasting calls on blocked servers. Use it when a task needs an OSM id, a way or a box search, or when an Overpass request fails.
---

# OpenStreetMap and Overpass

The record keeps the **identifier** of an OSM object (`w61412496`, `r19128860`), never its
geometry, except where a ticket says otherwise (`research-method`, "The place of an asset").

## What worked, what failed (18 October 2026)

| Call | Result |
|---|---|
| `fetch_document` on `nominatim.openstreetmap.org/lookup?osm_ids=R...,W...&format=xml` | Works: 9 of 9. Gives the object, stored as a document. |
| `fetch_document` on `api.openstreetmap.org` for one object by id | Works. |
| `fetch_document` on `overpass-api.de/api/interpreter?data=...` | Fails: 406 (the server refuses the tool). |
| Overpass mirrors (`overpass.kumi.systems`, `overpass.private.coffee`) | Fail: 500, or refused by CORS in the browser. |
| Overpass in the browser of the lead session (`fetch` in the page) | Works at times (11 of 19). Answers 429 "server at capacity" or 502 when busy. |

## Steps

1. If you have the OSM id, use the Nominatim lookup through `fetch_document`. Stop there.
2. If you have only a name, run **one** Overpass request in the browser, with a small box, not a
   country: `[out:json][timeout:40];nwr["name"~"Vadinar|Nayara",i](22.2,69.4,22.6,70.2);out center tags 40;`.
   A request over a whole country (`area["ISO3166-1"="RU"]`) timed out or returned 502: use it
   once, and keep the answer.
3. Save the answer as `research/inbox/osm-overpass-<site>.json` and store it with
   `store_saved_file`. A stored answer is citable; an answer you only read is not.
4. On 429 or 502, wait and retry once. After that, put the site on `research/out/needs.md` and
   go on. Do not try more mirrors.
5. Propose the OSM id as the identifier. For the point, follow the order of `research-method`.

## Do not

- Do not call Overpass from a subagent: it has no browser, and the tool gets 406.
- Do not run one request for each site when a single box request covers a region.
- Do not read a point off OSM for a site that was built after the data, without the satellite
  check.
