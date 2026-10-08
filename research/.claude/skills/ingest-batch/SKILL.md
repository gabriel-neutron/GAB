---
name: ingest-batch
description: Store a list of URLs as documents, and give the table of the result. Use it when you have more than one source to put into Gabriel. It queues the extraction of the back-end AI only when the operator asks for it.
---

# Ingest a batch

Use this skill for a list of URLs. Gabriel stores each source. You then propose the facts of your
layer with the skill `cite-claim`. The extractor (the back-end AI) and the lead agent run only
when the operator asks for them, because they propose each claim of a document, also the claims
outside your layer.

## Tools

- `find_document`: find a page that Gabriel already stores, by its address.
- `fetch_document`: store one page and get its document id.
- `enqueue_extract`: queue the extraction of the claims of one stored document. It returns the
  job id.
- `job_status`: read the state of the jobs of one document and the number of their proposals.
- `list_proposals`: read the proposals that the extraction made for one document.
- `document_text`: read the stored text of one document, page by page.
- `start_lead`: give a lead to the lead agent of Gabriel. It returns the job id.

## Steps

1. Make the list of sources. Use one URL for each source. Remove the duplicates.
2. Call `find_document` with each URL. If Gabriel stores the page, keep its document id and do
   not fetch it again.
3. Call `fetch_document` for each other URL, one URL for each call. Keep the document id of each
   one. If the answer has `rendered`, keep the id of `rendered.document`.
4. Read the start of the stored text of each document with `document_text`. A challenge page,
   an error page or an empty text is not the source: follow "A blocked source" in the skill
   `research-method`.
5. Only when the operator asks for an extraction: call `enqueue_extract` with the document id,
   follow it with `job_status`, and read its proposals with `list_proposals`. Propose only a fact
   that it missed.
6. Give the result as a table: URL, document id, status (stored, known, blocked), and the reason
   of each failure.

## Never

- Never queue an extraction or start a lead that the operator did not ask for.
- Never propose a fact that a pending proposal holds for the same document.
- Never fetch a search result list as a source. Fetch the page that the result points to.
- Never crawl. One fetch takes one URL that you chose.
- Never queue a document that is not stored.
