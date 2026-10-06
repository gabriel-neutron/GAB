---
name: ingest-batch
description: Store a list of URLs as documents, queue the extraction of each one, and follow the jobs to the end. Use it when you have more than one source, or a long document, to put into Gabriel.
---

# Ingest a batch

Use this skill for a list of URLs. Gabriel stores each source, and the extractor (the back-end
AI) proposes the claims of each one. You do not extract with your own tokens.

If you have a lead and no list of URLs (for example "Intershipping and its vessels"), call
`start_lead` with the lead. The lead agent of Gabriel searches, stores each new page and queues
its extraction, with its own tokens. Later, find the pages that it stored with `find_document`,
and continue at step 6.

## Tools

- `find_document`: find a page that Gabriel already stores, by its address.
- `fetch_document`: store one page and get its document id.
- `enqueue_extract`: queue the extraction of the claims of one stored document. It returns the
  job id.
- `job_status`: read the state of the jobs of one document and the number of their proposals.
- `list_proposals`: read the proposals that the extraction made for one document.
- `start_lead`: give a lead to the lead agent of Gabriel. It returns the job id.

## Steps

1. Make the list of sources. Use one URL for each source. Remove the duplicates.
2. Call `find_document` with each URL. If Gabriel stores the page, keep its document id and do
   not fetch it again.
3. Call `fetch_document` for each other URL, one URL for each call. Keep the document id of each
   one. If the answer has `rendered`, keep the id of `rendered.document`.
4. If a fetch fails, write the URL and the reason. Do not try a different copy of the page
   without a reason that you can give.
5. Call `enqueue_extract` with each new document id. Keep the job id that each call gives. If the
   tool says that an extraction is queued or runs already, do not queue it again.
6. Call `job_status` for each document. Wait between two calls. Stop when each job is done or
   failed.
7. For each done job, call `list_proposals` with the document id. These are the claims of the
   extractor. Propose only a fact that it missed, with the skill `cite-claim`. When the job
   gives `refused`, the extractor lost the claims of those parts: read the document with
   `document_text` and propose what those parts state.
8. Give the result as a table: URL, document id, job status, number of proposals, refused parts,
   failure reason.

## Never

- Never extract the facts of a long document with your own tokens. Store it and queue it.
- Never propose a fact that the extractor proposed for the same document.
- Never fetch a search result list as a source. Fetch the page that the result points to.
- Never crawl. One fetch takes one URL that you chose.
- Never queue a document that is not stored.
