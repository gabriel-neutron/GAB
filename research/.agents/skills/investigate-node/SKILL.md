---
name: investigate-node
description: Find what Gabriel holds about one node, from its name or from an identifier such as an IMO number, and list the gaps and the next sources to fetch. Use it before you propose a fact about a vessel, a company or a person.
---

# Investigate a node

Use this skill when a ticket gives you a node name or an identifier. The result is a short list:
what Gabriel holds, which documents it cites, what waits in the queue, what is missing, and which
pages to fetch next.

## Tools

- `list_vocabulary`: get the entity types, the relation types and the identifier keys.
- `search_graph`: find an entity by an identifier (for example the key `imo` and the value
  `9123456`), or by its name when you have no identifier.
- `read_entity`: read the attributes, the relations and the sources of one entity.
- `neighbourhood`: find the entities two or three relations away, for a network.
- `list_proposals`: read the pending proposals on the entity.
- `document_text`: read the text of a document that the entity or a relation cites.
- `web_search`: ask a search engine for pages that can hold a fact that Gabriel lacks. A result
  is a lead only. Fetch the page before you cite it.
- `gleif_lookup`: read one LEI in GLEIF, with its direct and ultimate parent. No key is needed.
- `companies_house`: read one UK company by its company number. It needs a key, and it says so
  when the key is not set.
- `wikidata_ids`: find the other identifiers that Wikidata holds for one item.
- `sanctions_match`: read one OpenSanctions entity, or search by IMO number or name for leads.
  It needs a key, and it says so when the key is not set.
- `vessel_events`: read the encounter, loitering and AIS gap events of one vessel for a range of
  dates. It needs a free token, and it says so when the token is not set.

## Steps

1. If you do not know the identifier keys, call `list_vocabulary`.
2. If you have an identifier, call `search_graph` with `identifier`, its key and its value. Search
   each identifier that you have: an IMO number, an MMSI, a registration number, a company number.
3. If you have a name only, call `search_graph` with `query`. A match by name is a lead. Confirm
   it with an identifier before you use it.
4. If no entity matches, record "not in Gabriel". Do not create the entity here. The skill
   `cite-claim` creates it, with a source.
5. For each entity that matches, call `read_entity`. Write down its attributes, its relations with
   their direction and dates, and the documents that they cite. Call `neighbourhood` when you need
   the entities further away.
6. Call `list_proposals` with the entity id. A pending proposal is a fact that waits for the
   operator: do not propose it again.
7. Read each cited document with `document_text` when you must know what it says. Read the pages
   that you need, not the whole document.
8. Write the gaps: each fact that the ticket asks for and that no document in Gabriel holds. For
   example: no owner, no flag after a given date, no manager.
9. For each gap, write the next source to fetch: the registry, the official list or the page that
   can hold the fact. Use `web_search` to find it. A search engine result is a lead only.
   When you hold an LEI, a UK company number or a Wikidata item id, call the lookup tool of that
   register: it stores the answer as a document. With a name only, a lookup gives a list of
   leads and stores nothing. Choose the identifier from the list, then call the tool again with
   it.
   When you hold an IMO number, call `sanctions_match` for leads and then read the entity that
   fits. Store the official entry that it names with `fetch_document`. For the movement of a
   vessel, call `vessel_events` with its GFW vessel id.
10. Give the result as five lists: held, cited documents, pending proposals, gaps, next sources.

## Never

- Never propose a new entity before you call `search_graph` with each identifier that you have.
- Never treat a name match as the same node without an identifier or a document that connects
  them.
- Never write a fact into the result that no stored document holds. Write it as a gap.
- Never read a long document with your own tokens to extract facts. Use the skill
  `ingest-batch`.
