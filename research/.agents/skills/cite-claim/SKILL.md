---
name: cite-claim
description: Turn facts that the extractor missed into proposals that cite a stored document. Find the excerpt in the stored text, then propose a batch with the page and the excerpt of each fact. Use it each time you add a fact to Gabriel.
---

# Cite a claim

The extractor proposes the claims of each document that you queue. Use this skill for a fact that
it missed. One fact gives one item of a batch. A batch can hold linked facts, for example a
company, its vessels and the relations between them. Each item cites the page and the excerpt
that state it.

## Tools

- `list_vocabulary`: get the entity types, the relation types and the identifier keys.
- `find_document`: find the stored document that holds the fact.
- `fetch_document`: store a new page and get its document id and its text.
- `document_text`: read the stored text of a document again, page by page.
- `search_graph`: find the entity that already holds an identifier.
- `list_proposals`: find the proposals that wait for the operator.
- `propose`: propose a batch of new entities, new relations and new attributes.

## Steps

1. Find the document that holds the fact with `find_document`. If Gabriel does not store it,
   fetch it with `fetch_document` and queue its extraction (skill `ingest-batch`).
2. Find the excerpt that states the fact in the stored text. Use `document_text` for the page.
   If the excerpt is not in the stored text, stop. The fact has no source in Gabriel.
3. Call `list_proposals` with the document id. If a proposal holds the fact, stop: the extractor
   or another session proposed it.
4. Before you propose a new entity, call `search_graph` with each identifier of that entity. If
   an entity matches, propose attributes or a relation on it. Do not propose a second entity.
5. Use the types and the keys of `list_vocabulary`. Put the unit in the key of an attribute, for
   example `capacity_dwt`. Write each attribute as `{"key": {"v": value}}`.
6. Call `propose` with one item for each fact. Each item gives a `ref`, the act, the
   `originator` (the party that first stated the fact), the `modality`, and in `evidence` the
   document id, the page and the excerpt. Copy the excerpt word for word. A relation names an
   entity of an earlier item of the batch by its `ref`, and an entity of the record by its id.
7. If the tool refuses the batch, read the item, the field and the reason that it names, correct
   that item, and call `propose` again. A retry writes nothing twice.
8. If the answer marks an item as disputed, a value of the act is not in its excerpt. Check the
   value. Keep the proposal ids that the tool gives. The skill `carto-step` reports them.

## A sanctions status

- Cite a sanctions status from the official entry, stored with `fetch_document`: the OFAC entry
  page, the EU act in EUR-Lex (`legal_act`), or the UK list entry.
- Never cite OpenSanctions or a news article as the source of a listing.
- A match list is a lead, and not a source. Fetch the official entry and cite that.
- Write the status as ADR 0011 says: "listed by the EU on <date> under Regulation <n>; status
  checked on <snapshot date>".

## Never

- Never cite a bare URL. Cite the document id that `find_document` or `fetch_document` gave.
- Never cite `manual` or `inherited`. Only the operator cites these.
- Never cite a search result list or a match list. Fetch the page that the result points to.
- Never put two facts in one item, and never cite a document that does not hold the fact.
- Never propose an entity before you search each identifier that you have.
- Never propose a fact that a pending proposal holds.
