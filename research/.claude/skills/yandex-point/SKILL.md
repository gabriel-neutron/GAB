---
name: yandex-point
description: Find an industrial site (refinery, terminal, plant) on Yandex Maps satellite view and let the operator place its point. Use it when a site has no official coordinate and no GEM row, and the operator chose Yandex Maps to find the site. The point is cited with a stored open image, never with a Yandex page.
---

# Point from Yandex Maps

This skill is an **exception** to the order of `research-method` ("The place of an asset"): there,
only the operator places a point on a satellite image. Use this skill only when the operator names
Yandex Maps as the tool to find the site (as in the sessions of 18 October 2026). Without that
choice, use only `research-method`. A Yandex point waits in review as a proposal, with a doubt
for the reviewer. It is never a decided fact.

## What works

- Yandex Maps (`yandex.com/maps`, also `yandex.by`) opens in the browser of the lead session.
  The satellite view has no labels, so find the site first on the map view, then switch to the
  satellite view (`l=sat`).
- The page "What is here" gives a coordinate for a clicked point. Use it to read the point of the
  operator. Note that `ll` is longitude first. Never store this page: the store gate refuses each
  Yandex Maps address, and the Yandex terms do not allow the storage of their content.
- Precision is about 50 to 300 m. Aim at the process units (columns, furnaces), not at the
  office of the listing.

## Steps

1. Get the name of the site in Russian, and the city, from a stored source (Wikipedia, the
   company site, GEM). Search Yandex Maps with the Russian name.
2. Check that the site is the right one. In a city with more than one plant (Ufa has three that
   touch), the distance to the office of the listing is not proof: compare the name on the map
   view, then place the point on the units.
3. Ask the operator to put the cursor on the units in the satellite view. Read the coordinate of
   the "What is here" page. Do not store the page and do not store a card of it.
4. Store the open image of the site with `site_image` (Sentinel-2 2016, CC BY 4.0). For a site
   built after 2016, use `sentinel2_pairs`. Check that the site is visible on the image.
5. Propose the point with the skill `cite-claim`: `geomMethod` "satellite_match", the image
   document, and its "Box (WGS 84)" line as the excerpt. The excerpt does not state the point, so
   the item waits as a doubt for the reviewer. Name what the point marks (`plant`, `port`,
   `gate`, `berth`) in the originator text, with "placed by the operator on Yandex Maps
   satellite, precision 50 to 300 m, date". Write the Yandex address in no document.

## Do not

- Do not use a subagent for this: a subagent has no browser.
- Do not propose the point of a ship quay as the point of a refinery. Name what the point marks
  (`plant`, `port`, `gate`, `berth`). Vadinar: the point was the jetty, not the refinery.
- Do not change the point of an entity that waits in review: `update_entity` refuses it. Wait
  for the promotion, or give the point in the notes for the reviewer.
- Do not store a Yandex Maps page, or a card of it, as a source. The coordinate that you read
  comes from the Yandex service: it is a geocoder answer (`geocode-check`). The cards stored on
  18 October 2026 stay in the record. A reviewer re-cites or rejects each proposal that cites one.
