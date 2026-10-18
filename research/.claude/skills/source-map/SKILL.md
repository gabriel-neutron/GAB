---
name: source-map
description: Know which data sources answered and which failed in past sessions, so that a new session picks the right source first. Use it before a search for a vessel, a facility, an owner, a port code or a shipment.
---

# Source map

Measured on the sessions of 17 and 18 October 2026 (fetch calls that stored a document, over
the last 36 hours). Update this table when a source changes.

## Sources that answered

| Need | Source | Result |
|---|---|---|
| Shadow-fleet vessel, owner, manager, flag | `war-sanctions.gur.gov.ua` (GUR, Ukraine). Pages `/en/transport/shadow-fleet/<id>` and `/en/transport/ships?f[search]=<IMO>` | 61 of 61 stored. Search by IMO number. Treat it as an assertion of one state, with the modality `asserts`. |
| Facility, pipeline, refinery, owner share | `gem.wiki` (Global Energy Monitor) and the GEM trackers | 36 of 37. Cite the page; GEM is the origin of its row. |
| Port code | `unlocode.info` | 10 of 10. The UNECE site `service.unece.org` gives 403 and the archive gives 429. |
| EU act | `eu_act` with the CELEX number | Works. Do not fetch EUR-Lex by hand. |
| OFAC and UK lists | `ofac_sdn`, `uk_sanctions_list` | Work. Cite one entry. `uk_sanctions_list` failed 3 times of 4 on 18 October. After 3 failures, do not call it again in the session (`source-hunt`). |
| Shipping news on a cargo | `gcaptain.com`, `reuters.com`, `thebarentsobserver.com`, `energyandcleanair.org` | Store the article. Reuters only for the lead; the claim needs its own source. |
| Lead search | `web_search` (works since the repair), or `html.duckduckgo.com/html/?q=` through `fetch_document` | 107 of 107 and 19 of 19. A result page is a lead, never a source (`source-hunt`). Fetch the page that it points to. |
| Place | `yandex-point`, `osm-overpass`, `geocode-check` | See each skill. |

## Sources that failed, and what to do

| Source | Failure | Next step |
|---|---|---|
| `news_search` | 8 failures of 8 | Do not call it. Use `web_search`. |
| Russian company and state sites (`neftegaz.ru`, `gazprom.ru`, `rosneft.ru`, `mil.ru`, `fs.moex.com`) | Timeout, ECONNRESET, 403 | Browser of the lead session, then `research/out/needs.md`. |
| `web.archive.org` | 429 from the PC address | One call for each URL, no retry. |
| `service.unece.org` | 403 | Use `unlocode.info`. |
| Files above 20 MB | `store_saved_file` refuses | Ask for a tool cap change, or cite the pages from the operator. |
| `sanctions_match`, `vessel_events` | 1 failure each (key or time) | Check the error text once, then use the official list. |

## Habits that cost calls

- A fetch of a URL that is already on `research/out/needs.md`. Read the list first.
- Retrying a site that failed 3 times. Put its next URLs on the list.
- Paging through a whole list with `document_text`. Use the entry tools.
- A subagent that asks for the browser: it has none. Give browser steps to the lead session.
