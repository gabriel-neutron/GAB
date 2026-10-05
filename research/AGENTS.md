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
3. **Store the document and queue the extraction. Never extract with your own tokens** (ADR 0010
   §1). After the fetch, call `enqueue_extract` with the document id. The back-end AI does the
   extraction. Use `job_status` to see when it is done.
4. **A search result is a lead, and not a source** (ADR 0010 §6). A list of search results is not
   stored, and you must not cite it. Fetch the page that the result points to. Only a fetched
   page is a document.
5. **The CARTO plan §4 and §10 rules apply as ADR 0011 states them.** ADR 0011 is the authority.
   Do not make a rating table of your own.
   - CARTO plan §4: ADR 0011 §1, the row "Grade by claim type". The plan grade "A1 listing, A2
     reasons, B2 for flag/owner fields" is a misuse. The rule is: "No claim-kind column. Access and
     modality are per span. The register card says which fields the issuer declares."
   - CARTO plan §10: ADR 0011 §13, item d, "Status wording only": "listed by the EU on <date>
     under Regulation <n>; status checked on <snapshot date>". GAB voice never uses "evader",
     "shadow fleet vessel" or "fraudulent registry" unless an issuer text uses the word, with that
     text cited.
6. **Work in ASD-STE100 Simplified Technical English. Write the deliverables in French** (CARTO
   plan §12). Your messages, your notes and your comments on a ticket are in ASD-STE100 English.
   The text that goes into Gabriel is in French.
