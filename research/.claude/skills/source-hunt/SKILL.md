---
name: source-hunt
description: Store sources as documents in Gabriel, from one URL or a list, and get past a blocked site. Use it before each citation of a source that Gabriel does not hold, and when a fetch fails.
---

# Source hunt

Each citation names a stored document. This skill stores the sources, in as few calls as
possible. You then propose the facts with the skill `cite-claim`.

## Steps

1. Make the list of sources: one URL for each source, with no duplicate.
2. Read `research/out/needs.md` for each URL. A URL that is on it failed in an earlier session:
   go to step 5 for it, and do not fetch it again.
3. Call `find_document` with each URL. When Gabriel stores the page, keep its document id.
4. Call `fetch_document` for each other URL, one URL for each call. Keep the document id. When
   the answer has `rendered`, keep the id of `rendered.document`. Read the start of the stored
   text with `document_text`: a challenge page, an error page or an empty text is not the source.
   When the fetch is refused, read the refusal: it names the next step.
5. When the fetch fails, try these in order, and stop at the first that stores the full text:
   1. **Another official copy** of the same text from the same issuer: the PDF of the publisher,
      the Publications Office of the EU for an EU act (`eu_act` with the CELEX number), a
      repository of the paper (EconStor, RePEc, SSRN), the page of the institution itself. Find
      it with `web_search`.
   2. **The browser** of the session (see "The browser step").
   3. **The web archive.** `archive_snapshot` lists the captures. Then `fetch_document` on the
      address of the newest capture. The archive often refuses the address of the PC (429): one
      call for each URL, never a retry. An address with a query string has no capture.
   4. **The list of needs.** Add the source to `research/out/needs.md`, and continue with the
      next fact.
6. Give the result as a table: URL, document id, status (stored, known, blocked), and the reason
   of each failure.

## Calls that give nothing

- A tool that answers that its key is refused or not set (401, 402), or that fails 3 times in a
  session: do not call it again in this session. Write it once in the report.
- A site that fails 3 times in a session: put its next URLs directly on the list of needs.
- A whole official list: cite one entry with `ofac_sdn` (ent_num) or `uk_sanctions_list` (Unique
  ID). Never page through the text of a list with `document_text`.

## The browser step

The browser runs on the operator's machine, with a home address and real cookies, so most filters
let it pass. Only the lead session drives the browser: a subagent of a workflow has no browser,
and it writes the URL on the list of needs of its lot.

- Before you save, read the page. If it shows an account of the operator (a name, "signed in", a
  basket, a private message), do not save it: put the source on the list of needs.
- The browser downloads into its download folder, and `GAB_INBOX` in `research/.env` names that
  folder. Give each file a name that no other file has: the domain, a short title and the date,
  for example `gazprom-com-annual-report-2024.pdf`.
- A PDF: click its link, so that the browser downloads the file.
- An HTML page: run this in the page with the JavaScript tool of the browser, with your file name:
  `const b = new Blob(['<!doctype html>\n' + document.documentElement.outerHTML], {type: 'text/html'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'name.html'; a.click();`
- Never write the file yourself with a file tool, and never change it. The bytes must be what the
  browser held.
- Call `store_saved_file` with the file name and the address of the page, and cite the document
  that it gives. Its title says "saved by the browser".

## The list of needs

Each line of `research/out/needs.md` gives what the operator needs to store the source:

| Source | Address | Error | What to get | File name | Where it is used |
|---|---|---|---|---|---|
| The title and the issuer | The address that failed | 403, 404, timeout, empty | The PDF, or the page saved from a browser | The unique name to give the file | The node and the fact that wait for it |

The operator saves the file into the inbox. In the next session, store it with `store_saved_file`
and find it with `find_document`.

## Back-end AI

The extractor and the lead agent spend model credit. Only when the operator asks for an
extraction: call `enqueue_extract` with the document id, follow it with `job_status`, and read its
proposals with `list_proposals`. Propose only a fact that it missed. Call `start_lead` only when
the operator asks for it.

## Never

- Never fetch a search result list as a source. Fetch the page that the result points to.
- Never crawl. One fetch takes one URL that you chose.
- Never cite a page that you saw in a browser or in a search result: store it, and cite the
  stored document.
- Never write in `research/out/` a private file of the operator. Write only public addresses and
  your notes.
