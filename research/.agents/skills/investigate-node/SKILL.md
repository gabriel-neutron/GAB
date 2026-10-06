---
name: investigate-node
description: Find what Gabriel holds about one node, from its name or from an identifier such as an IMO number, and list the gaps and the next sources to fetch. Use it before you propose a fact about a vessel, a company or a person.
---

# Investigate a node

Use this skill when a ticket gives you a node name or an identifier. The result is a short list:
what Gabriel holds, which documents it cites, what is missing, and which pages to fetch next.

## Tools

- `lookup_entity`: find the entities that hold an identifier, by the attribute key and its exact
  value (for example the key `imo` and the value `9123456`).
- `search_graph`: find an entity by its name when you have no identifier.
- `neighbourhood`: read the relations of the entity and the entities at the other end.
- `document_text`: read the text of a document that the entity or a relation cites.
- `web_search`: ask a search engine for pages that can hold a fact that Gabriel lacks. A result
  is a lead only. Fetch the page before you cite it.

## Steps

1. If you have an identifier, call `lookup_entity` with its key and its value. Look up each
   identifier that you have: an IMO number, an MMSI, a registration number, a company number.
2. If you have a name only, call `search_graph` with the name. A match by name is a lead. Confirm
   it with an identifier before you use it.
3. If no entity matches, record "not in Gabriel". Do not create the entity here. The skill
   `cite-claim` creates it, with a source.
4. For each entity that matches, call `neighbourhood`. Write down the relations, their dates and
   the document ids that they cite.
5. Read each cited document with `document_text` when you must know what it says. Read the pages
   that you need, not the whole document.
6. Write the gaps: each fact that the ticket asks for and that no document in Gabriel holds. For
   example: no owner, no flag after a given date, no manager.
7. For each gap, write the next source to fetch: the registry, the official list or the page that
   can hold the fact. Use `web_search` to find it. A search engine result is a lead only.
8. Give the result as four lists: held, cited documents, gaps, next sources.

## Never

- Never propose a new entity before you call `lookup_entity` with each identifier that you have.
- Never treat a name match as the same node without an identifier or a document that connects
  them.
- Never write a fact into the result that no stored document holds. Write it as a gap.
- Never read a long document with your own tokens to extract facts. Use the skill
  `ingest-batch`.
