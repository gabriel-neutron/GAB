---
name: cite-claim
description: Turn facts into proposals that cite a stored document. Fetch the page, find the excerpt in the stored text, then propose the change with the page and the excerpt. Use it each time you add a fact to Gabriel.
---

# Cite a claim

One fact gives one item of a batch. A batch can hold linked facts, for example a company, its
vessels and the relations between them. Each item cites the page and the excerpt that state it.

## Tools

- `fetch_document`: store the page and get its document id and its text.
- `document_text`: read the stored text of a document again, page by page.
- `lookup_entity`: find the entity that already holds an identifier.
- `propose`: propose a batch of new entities, new relations and new attributes.

## Steps

1. Fetch the page that holds the fact with `fetch_document`. Keep the document id that it gives.
   If the answer says `known`, the page is already stored: use the id that it gives.
2. Find the excerpt that states the fact in the stored text. Use the text that `fetch_document`
   gave, or call `document_text` for the page. If the excerpt is not in the stored text, stop.
   The fact has no source in Gabriel.
3. Before you propose a new entity, call `lookup_entity` with each identifier of that entity. If
   an entity matches, propose attributes or a relation on it. Do not propose a second entity.
4. Call `propose` with one item for each fact. Each item gives a `ref`, the act, the
   `originator` (the party that first stated the fact), the `modality`, and in `evidence` the
   document id, the page and the excerpt. Copy the excerpt word for word. A relation names an
   entity of an earlier item by its `ref`.
5. If the tool refuses the batch, read the item and the reason that it names, correct that item,
   and call `propose` again. A retry writes nothing twice.
6. If the answer marks an item as disputed, a value of the act is not in its excerpt. Check the
   value. Keep the proposal ids that the tool gives. The skill `carto-step` reports them.

## A sanctions status

- Cite a sanctions status from the official entry, stored with `fetch_document`: the OFAC entry
  page, the EU act in EUR-Lex (`legal_act`), or the UK list entry.
- Never cite OpenSanctions or a news article as the source of a listing.
- A match list is a lead, and not a source. The tool `sanctions_match`, when GAB has it, finds the
  entry. It is not the citation. Fetch the official entry and cite that.
- Write the status as ADR 0011 says: "listed by the EU on <date> under Regulation <n>; status
  checked on <snapshot date>".

## Never

- Never cite a bare URL. Cite the document id that `fetch_document` gave.
- Never cite `manual` or `inherited`. Only the operator cites these.
- Never cite a search result list or a match list. Fetch the page that the result points to.
- Never put two facts in one item, and never cite a document that does not hold the fact.
- Never propose an entity before you look up each identifier that you have.
