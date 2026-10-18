---
name: geocode-check
description: Check an address or a point with a geocoder (ArcGIS, Nominatim, Yandex) as a verification only. Use it when a note must say that a geocoder agrees with a source, and never to produce a point for the record.
---

# Geocoder check

A geocoder is a check, not a source (`research-method`). Its licence forbids storage or binds the
record, and an address point marks an entrance, not a plant. Run the query, read the answer, and
write only "geocoder X agrees within N m with source Y on date D" in your notes.

## What works from the operator PC

| Geocoder | Result |
|---|---|
| ArcGIS `geocode.arcgis.com` (no key, `findAddressCandidates`) | Works. Handles Russian addresses ("Рязань, Южный промузел, 8" gives a point address, score 98). |
| Yandex geocoder API | Fails without a key (400). Use the Yandex Maps page instead (`yandex-point`). |
| Nominatim | Works for a lookup by OSM id (`osm-overpass`). A free-text search is slow and rate-limited: one call each second at most. |
| Esri World Imagery | Visual check only. Store nothing, place no point from it. |

## Steps

1. Query with `curl` or the browser. Keep the answer in your scratch file, not in the inbox.
2. Compare to the point you hold. Use the gaps of `research-method`: 1 km for a plant or a port,
   200 m for a gate or a berth. A larger gap means two places.
3. Write the result in the notes of the proposal. Never store the answer with `fetch_document`
   or `store_saved_file`, and never propose its coordinate.

## Do not

- Do not use the point of a city (for example a UN/LOCODE point) as the point of a plant.
- Do not trust the first candidate when the score is under 90.
