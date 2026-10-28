---
name: source-hunt
description: Store sources as documents in Gabriel, from one URL or a list, and get past a blocked site. Use it before each citation of a source that Gabriel does not hold, and when a fetch fails.
---

# Source hunt

Each citation names a stored document. This skill stores the sources, in as few calls as
possible. You then propose the facts with the skill `cite-claim`.

## Steps

1. Make the list of sources: one URL for each source, with no duplicate.
2. Call `find_document` with each URL. When Gabriel stores the page, keep its document id. When
   the URL is on `research/out/needs.md` and the operator saved its file into the inbox, store it
   with `store_saved_file`, and remove its line from the list of needs.
3. Read `research/out/needs.md` for each other URL. A URL that is on it failed in an earlier
   session: go to step 5 for it, and do not fetch it again.
4. Call `fetch_document` for each other URL, one URL for each call. Keep the document id. When
   the answer has `rendered`, keep the id of `rendered.document`. Read the start of the stored
   text with `document_text`: a challenge page, an error page or an empty text is not the source.
   The tool renders a page with JavaScript when its text is short, and it refuses a challenge
   page. When the fetch is refused, read the refusal: it names the next step. A `.ru` host that
   refuses is never read through the proxy on this call: that is step 5.4.
5. When the fetch fails, find the next step in this table, then try the steps below in order.
   Stop at the first that stores the full text.

   | Refusal | Usual cause | Next step |
   |---|---|---|
   | 403, 429 or 503, a 202 or a 200 with no text, a challenge page | A bot filter (Cloudflare, AWS WAF) | Another copy, then the browser |
   | No whole answer within the time, no connection | A state site that refuses foreign addresses | The browser, then the list of needs |
   | 404 or 410, or the page says that it is missing | The address is wrong or old | Another copy, then the archive; never the browser |
   | A 200 with the page "Доступ временно ограничен" from a `.ru` state site | A block of foreign addresses | The browser, then the paid proxy |
   | A 200 with no text from Interfax e-disclosure (`e-disclosure.ru`) | A filter that runs a script in the page | The browser, one page at a time and slowly |

   1. **Another official copy** of the same text from the same issuer: the PDF of the publisher,
      the Publications Office of the EU for an EU act (`eu_act` with the CELEX number), a
      repository of the paper (EconStor, RePEc, SSRN), the page of the institution itself. Find
      it with `web_search`. For a Russian or a Belarusian company, the copy of a register
      aggregator is no official copy: use it only as the skill `research-method` says (a
      register aggregator).
   2. **The browser** of the session (see "The browser step").
   3. **The web archive.** `archive_snapshot` lists the captures. Then `fetch_document` on the
      address of the newest capture. The archive often refuses the address of the PC (429): one
      call for each URL, never a retry. An address with a query string has no capture.
   4. **The paid proxy.** Call `fetch_document` again with `proxy` true. It reads a `.ru` or
      `.рф` host once through a Russian exit, and costs 10 credits for each page that it reads.
      It works only when the operator set the key. Use it only when all of these hold: the
      source is the official page of a Russian issuer, a fact of the current layer waits for
      it, no other copy is stored, and the steps above failed. One page for each call: never
      for a list, never for a page that needs JavaScript, never a retry. Write the error of
      each earlier step in the report. A page that comes back through the proxy says so in its
      `notice`: keep that in the report, and replace it with a direct or browser copy when one
      is reachable.
   5. **The blocked queue.** When steps 1 to 4 failed and the source is a plain page or file that
      a country exit could read (no CAPTCHA, no sign-in), add one row to
      `research/out/blocked.md` and continue with the next fact. Do not stop and do not drop the
      source. The paid batch pass reads the queue (see "The paid batch pass").
   6. **The list of needs.** Add the source to `research/out/needs.md`, and continue with the
      next fact. Use it for a CAPTCHA, a sign-in, a library, a paid database or a file that only
      the operator can get, and for a row that the batch pass could not store.
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
and it returns the URL in its result for the lead session.

- Before you store, read the page. If it shows an account of the operator (a name, "signed in",
  a basket, a private message), do not store it: put the source on the list of needs.
- The page gives its bytes to `store_saved_file` directly. No file goes to the download folder,
  so no save dialog opens. Never click a PDF link to download it, and never start a download.
- An HTML page: run this in the page with the JavaScript tool of the browser. It keeps the bytes
  in `window.gab` and gives the count of the characters of their base64 text and their SHA-256:
  `(async () => { const u = new TextEncoder().encode('<!doctype html>\n' + document.documentElement.outerHTML); const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', u))].map((b) => b.toString(16).padStart(2, '0')).join(''); let s = ''; for (const b of u) s += String.fromCharCode(b); window.gab = btoa(s); return { length: window.gab.length, sha256: h }; })()`
- A PDF: run this in a page of the same site as the PDF (the page that links it), with the
  address of the PDF. A page of another site is refused by the browser, and the page of the PDF
  itself often runs no script:
  `(async () => { const r = await fetch('<address of the PDF>'); if (!r.ok) throw new Error(String(r.status)); const u = new Uint8Array(await r.arrayBuffer()); const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', u))].map((b) => b.toString(16).padStart(2, '0')).join(''); let s = ''; for (const b of u) s += String.fromCharCode(b); window.gab = btoa(s); return { length: window.gab.length, sha256: h }; })()`
- Then read the text in parts of 20,000 characters: `window.gab.slice(0, 20000)`, then
  `window.gab.slice(20000, 40000)`, and so on. Call `store_saved_file` with each part, in order:
  `content` (the part), `type` (`text/html`, `application/pdf`, or the type of a data file:
  `application/json`, `text/csv`, `text/tab-separated-values`, `application/xml`,
  `text/plain`), `sha256` (the hash that the
  browser gave), `part` (1, 2, ...), `parts` (the count of the parts) and `url` (the address of
  the page, or of the PDF). A text of 20,000 characters or less is one call with no `part` and no
  `parts`. Each part but the last answers `waiting`. The last part gives the document to cite.
  Its title says "saved by the browser". If a call refuses a part or the hash, send the parts
  again from part 1.
- Never write the bytes yourself and never change them. They must be what the browser held.

## The paid batch pass

The free steps run at each request, in the order of step 5. The tool of a third party that
charges for each request (Bright Data, residential proxy) never runs at a request. It runs once
for a topic, over the blocked queue, so the cost is known before it is spent.

1. **Queue.** `research/out/blocked.md` has one row for each blocked source: URL, topic (for
   example A1), the step of the chain or the fact that needs it, the error of each earlier step,
   and the status (`queued`, `approved`, `stored`, `needs`). A subagent has no write access to
   `research/out/`: it returns its blocked rows in its result, and the lead session adds them.
   Check the URL against the queue before you add it: no duplicate.
2. **Filter.** At the end of the collect step, the lead session removes the rows that a free step
   can store now, and the rows that no step of the chain needs. It sends a CAPTCHA, a sign-in
   and a paid database to `research/out/needs.md`.
3. **Ask once.** The lead session tells the operator the count of rows, the hosts and the cost
   estimate against the cap of the topic sheet, and waits for a yes. It never starts the pass on
   its own.
4. **Read.** Residential proxy only, with the exit in the country of the site. Never Web
   Unlocker, never a CAPTCHA solver, never a bypass of a bot filter. One row for each call, no
   retry, no crawl. Write the bytes to a new folder and store them with `store_saved_file`
   (`file`) or with `fetch_document` when a vendor address returns the bytes. A page that a
   proxy returns is a second-hand copy: keep the proxy in the note of the report, and replace it
   with a direct copy when one is reachable.
5. **Close.** Set each row to `stored` with its document id, or to `needs` and add it to
   `research/out/needs.md`. Write the real cost and the count of pages in the report of the
   topic. Stop at 80 % of the cap and ask the operator.

Before the first batch pass, the vendor and the way to call it (CLI or API; the plugin has only
skills, no MCP tool) must be set by a separate session. If it is not set, the queue waits, and
the rows go to the list of needs at the end of the topic.

## The list of needs

Each line of `research/out/needs.md` gives what the operator needs to store the source:

| Source | Address | Error | What to get | File name | Where it is used |
|---|---|---|---|---|---|
| The title and the issuer | The address that failed | 403, 404, timeout, empty | The PDF, the page saved from a browser, or the data file (`.json`, `.tsv`, `.csv`, `.xml`, `.txt`) | The unique name to give the file | The node and the fact that wait for it |

The operator saves the file by hand into the inbox (`GAB_INBOX` in `research/.env`, or
`research/inbox`). In the next session, store it with `store_saved_file` and `file` (the file
name), and find it with `find_document`.

## Back-end AI

The extractor and the lead agent spend model credit. Only when the operator asks for an
extraction: call `enqueue_extract` with the document id, follow it with `job_status`, and read its
proposals with `list_proposals`. Propose only a fact that it missed. Call `start_lead` only when
the operator asks for it.

## Never

- Never fetch a search result list as a source. Fetch the page that the result points to.
- Never crawl. One fetch takes one URL that you chose.
- Never queue the extraction of a document that is not stored.
- Never cite a page that you saw in a browser or in a search result: store it, and cite the
  stored document.
- Never write in `research/out/` a private file of the operator. Write only public addresses and
  your notes.
