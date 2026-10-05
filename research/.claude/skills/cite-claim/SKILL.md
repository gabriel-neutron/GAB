---
name: cite-claim
description: Turn one fact into one proposal that cites a stored document. Fetch the page, check that the excerpt is in the stored text, then propose the change with the document id. Use it each time you add a fact to Gabriel.
---

# Cite a claim

Use this skill for one fact at a time. One fact gives one proposal. The proposal cites the
document that holds the fact, and no other document.

## Tools

- `fetch_document`: store the page and get its document id and its text.
- `document_text`: read the stored text of a document again, page by page.
- `lookup_entity`: find the entity that already holds an identifier.
- `propose_change`: propose the new entity, the new relation or the new attributes.

## Steps

1. Fetch the page that holds the fact with `fetch_document`. Keep the document id that it gives.
   If the answer says `known`, the page is already stored: use the id that it gives.
2. Find the excerpt that states the fact in the stored text. Use the text that `fetch_document`
   gave, or call `document_text` for the page. If the excerpt is not in the stored text, stop.
   The fact has no source in Gabriel.
3. Before you propose a new entity, call `lookup_entity` with each identifier of that entity. If
   an entity matches, propose attributes or a relation on it. Do not propose a second entity.
4. Call `propose_change` with the act and with the document id in `documents`. The tool writes
   that id into `src` and into the `src` of each attribute (`attrs.<key>.src`). Make sure that
   each of these lists names the document id.
5. Put the excerpt in the attribute `attrs.evidence_note`, with the same document id as its
   source. Copy the excerpt as the document gives it. Do not rewrite it.
6. Keep the proposal id that the tool gives. The skill `carto-step` reports it.

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
- Never put two facts in one proposal, and never cite a document that does not hold the fact.
- Never propose an entity before you look up each identifier that you have.
