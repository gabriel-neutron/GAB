---
name: cite-claim
description: Turn facts into proposals that cite a stored document. Find the excerpt in the stored text, then propose a batch with the page and the excerpt of each fact. Use it each time you add a fact to Gabriel.
---

# Cite a claim

Use this skill for each fact that you add to Gabriel. The skill `research-method` says which facts
to propose and which to leave out. One fact gives one item of a batch. A batch can hold linked facts, for example a
company, its vessels and the relations between them. Each item cites the page and the excerpt
that state it.

## Tools

- `list_vocabulary`: get the entity types, the relation types and the identifier keys.
- `find_document`: find the stored document that holds the fact.
- `fetch_document`: store a new page and get its document id and its text.
- `gleif_lookup`, `companies_house`, `wikidata_ids`: read one record of a register by its
  identifier. Each answer is stored as a document, and the tool gives its document id.
- `sanctions_match`, `vessel_events`: read one OpenSanctions entity, or the events of one vessel
  in Global Fishing Watch. Each answer is stored as a document, and the tool gives its id.
- `eu_act`, `ofac_sdn`, `uk_sanctions_list`: store the official file of an EU act, of the OFAC
  SDN list or of the UK Sanctions List, and give the text or the line of one entry.
- `document_text`: read the stored text of a document again, page by page.
- `search_graph`: find the entity that already holds an identifier.
- `list_proposals`: find the proposals that wait for the operator.
- `propose`: propose a batch of new entities, new relations and new attributes.

## Steps

1. Find the document that holds the fact with `find_document`. If Gabriel does not store it,
   fetch it with `fetch_document`. If the fetch fails, follow "A blocked source" in the skill
   `research-method`.
2. Find the excerpt that states the fact in the stored text. Use `document_text` for the page.
   If the excerpt is not in the stored text, stop. The fact has no source in Gabriel. A PNG or
   JPEG image is the one exception: see "An image".
3. Call `list_proposals` with the document id. If a proposal holds the fact, stop: another session
   or the extractor proposed it.
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
8. If the answer marks an item as disputed, a value of the act is not in its excerpt, or the
   model of another family that reads each item does not find it in its passage. Check the value.
   If the answer gives `checkFailure`, no model checked the batch: the skill `research-method`
   says what to do. Keep the proposal ids that the tool gives. The skill `carto-step` reports them.

## An image

The stored text of a PNG or JPEG document is its OCR text. OCR can mix the columns of a chart and
misread a number, so the text can miss a fact that the image shows clearly.

1. Find the excerpt in the OCR text first. If the OCR text states the fact, cite it as usual.
2. Otherwise, download the image from the address of the stored document. Compute its SHA-256:
   the document id is `doc_` and the first 12 hexadecimal characters of it. If they differ, the
   image changed since it was stored: stop, and store the new image first.
3. Read the image. Write in `excerpt` the words that state the fact, as the image writes them,
   for example the parent, the line to the child, the child and its number. Set `fromImage: true`
   on that evidence. The page is the page of the OCR text, most often 1.
4. Code marks each such item as disputed, so the operator compares the words with the image. Give
   only the words that you read with no doubt. A label with a "?" stays as the image writes it.

## A register record

- A lookup tool stores one answer for each record that it reads, and it gives the document id.
  Read the text with `document_text`, find the excerpt, and cite that id in `propose`.
- A lookup by name is a list of leads, and nothing is stored. Never cite it. Read the record
  with its identifier, and cite the document of that record.

## A sanctions status

- Cite a sanctions status from the official file: the EU act from `eu_act` (`legal_act`), the
  line of the entry from `ofac_sdn`, or the line of the entry from `uk_sanctions_list`. The
  release reads the regime of a designation from these files only.
- Give a "designated by" relation the start date that the release compares across the regimes:
  for the EU, the entry into force of the act that added the vessel; for OFAC, the date of the
  Recent Actions notice (store that page with `fetch_document` and cite it beside the SDN line);
  for the UK, the "Date designated" column of the entry.
- Never cite OpenSanctions or a news article as the source of a listing. `sanctions_match`
  stores the OpenSanctions entity and gives the address of each official entry: store that
  entry with the official tool of its regime, and cite that document.
- A match list is a lead, and not a source. Fetch the official entry and cite that.
- Write the status in this form: "listed by the EU on <date> under Regulation <n>; status
  checked on <snapshot date>".

## A vessel event

- `vessel_events` stores the events of one vessel for a range of dates, and it gives the
  document id. Cite that document for an event that its text holds.
- A match by the MMSI alone is a lead: an MMSI is reused and spoofed. Join the events to a hull
  only through the GFW vessel id or the IMO number.

## Never

- Never cite a bare URL. Cite the document id that `find_document` or `fetch_document` gave.
- Never cite `manual` or `inherited`. Only the operator cites these.
- Never cite a search result list or a match list. Fetch the page that the result points to.
- Never put two facts in one item, and never cite a document that does not hold the fact.
- Never propose an entity before you search each identifier that you have.
- Never propose a fact that a pending proposal holds.
