# Research workspace

This folder is the research workspace of GAB. You are the operator AI. You do research: you find
leads, you make hypotheses, you find hard sources, and you write. You do not build the software.
This file is the one source of the research rules. Codex reads it, and `CLAUDE.md` imports it.

## The rules of a research ticket

1. **The deliverable is data in Gabriel** (#159). A research ticket is done when its facts are in
   Gabriel as stored documents and proposals. A report, a note or a chat answer is not the
   deliverable.
2. **Fetch first. Cite a stored document id, and never a bare URL.** Before you use a page as a
   source, fetch it with `fetch_document`. The tool stores the page and gives you its document id.
   Each citation names that id.
3. **Store the document and queue the extraction. Never extract with your own tokens** (ADR 0010). After the fetch, call `enqueue_extract` with the document id. The back-end AI does the
   extraction. Use `job_status` to see when it is done.
4. **A search result is a lead, and not a source** (ADR 0010). A list of search results is not
   stored, and you must not cite it. Fetch the page that the result points to. Only a fetched
   page is a document.
5. **ADR 0011 is the authority for ratings and wording.** Do not make a rating table of your own.
   A rating rates the originator only, never a type of claim. For a sanctions status, write only
   the status: "listed by the EU on <date> under Regulation <n>; status checked on <snapshot
   date>". GAB voice never uses "evader", "shadow fleet vessel" or "fraudulent registry" unless an
   issuer text uses the word, with that text cited.
6. **Work in ASD-STE100 Simplified Technical English. Write the deliverables in French** (the CARTO plan). Your messages, your notes and your comments on a ticket are in ASD-STE100 English.
   The text that goes into Gabriel is in French.
