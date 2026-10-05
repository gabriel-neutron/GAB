---
name: ingest-batch
description: Store a list of URLs or the files of a folder as documents, queue the extraction of each one, and follow the jobs to the end. Use it when you have more than one source, or a long document, to put into Gabriel.
---

# Ingest a batch

Use this skill for a list of URLs, or for a folder of sources. Gabriel stores each source and the
back-end AI does the extraction. You do not extract with your own tokens.

## Tools

- `fetch_document`: store one page and get its document id.
- `enqueue_extract`: queue the extraction of one stored document.
- `job_status`: read the state of the extraction jobs of one document.

## Steps

1. Make the list of sources. Use one URL for each source. Remove the duplicates.
2. Call `fetch_document` for each URL, one URL for each call. Keep the document id of each one.
   If the answer says `known`, the document is already stored. Keep its id and do not fetch it
   again.
3. If a fetch fails, write the URL and the reason. Do not try a different copy of the page
   without a reason that you can give.
4. Call `enqueue_extract` with each document id. Keep the job id that each call gives.
5. Call `job_status` for each document. Wait between two calls. Stop when each job is finished
   or failed.
6. Give the result as a table: URL, document id, job status, failure reason.

## Never

- Never extract the facts of a long document with your own tokens. Store it and queue it.
- Never fetch a search result list as a source. Fetch the page that the result points to.
- Never crawl. One fetch takes one URL that you chose.
- Never queue a document that is not stored.
