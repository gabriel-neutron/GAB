---
name: yandex-point
description: Place the point of an industrial site (refinery, terminal, plant) on Yandex Maps satellite view and store the proof. Use it when a site has no official coordinate and no GEM row, and the operator chose Yandex Maps as the source of the point.
---

# Point from Yandex Maps

This skill is an **exception** to the order of `research-method` ("The place of an asset"): there,
only the operator places a point on a satellite image. Use this skill only when the operator names
Yandex Maps as the source of the point (as in the sessions of 18 October 2026). Without that
choice, use only `research-method`. A Yandex point waits in review as a proposal, with a doubt
for the reviewer. It is never a decided fact.

## What works

- Yandex Maps (`yandex.com/maps`, also `yandex.by`) opens in the browser of the lead session.
  The satellite view has no labels, so find the site first on the map view, then switch to the
  satellite view (`l=sat`).
- The page "What is here" gives a coordinate for a clicked point. Use the URL form
  `https://yandex.com/maps/<city id>/<city>/?l=sat&ll=<lon>%2C<lat>&mode=whatshere&whatshere%5Bpoint%5D=<lon>%2C<lat>&z=17`.
  Note that `ll` is longitude first.
- Precision is about 50 to 300 m. Aim at the process units (columns, furnaces), not at the
  office of the listing.

## Steps

1. Get the name of the site in Russian, and the city, from a stored source (Wikipedia, the
   company site, GEM). Search Yandex Maps with the Russian name.
2. Check that the site is the right one. In a city with more than one plant (Ufa has three that
   touch), the distance to the office of the listing is not proof: compare the name on the map
   view, then place the point on the units.
3. Open the "What is here" URL on the point. Read the coordinate from the page.
4. Save a text card as `research/inbox/yandex-<site>-coord.html`: the title, the URL, the
   coordinate that you read. Store it with `store_saved_file`. The browser cannot send the whole
   page to Gabriel (the local upload is refused), so the card is the proof.
5. Propose the point with the skill `cite-claim`: `point_role` `plant`, `geomMethod`
   "satellite_match", the card as the document, and in the notes "Yandex Maps satellite, precision 50 to 300 m, date".

## Do not

- Do not use a subagent for this: a subagent has no browser.
- Do not propose the point of a ship quay as the point of a refinery. Name what the point marks
  (`plant`, `port`, `gate`, `berth`). Vadinar: the point was the jetty, not the refinery.
- Do not change the point of an entity that waits in review: `update_entity` refuses it. Wait
  for the promotion, or give the point in the notes for the reviewer.
- Do not store a geocoder answer as a source. See `geocode-check`. The card of this skill is a
  reading of the map page, not a geocoder answer.
