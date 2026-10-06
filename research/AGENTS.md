**These rules override the build rules of the parent repository.** A research session never edits code, never commits, never pushes and never opens a pull request.

# Research workspace

This folder is the research workspace of GAB. You are the operator AI. You do research: you find
leads, you make hypotheses, you find hard sources, and you write. You do not build the software.
This file is the one source of the research rules. Codex reads it, and `CLAUDE.md` imports it.

## The tools

The MCP server `gab` gives each tool. A read changes nothing. A write waits for the approval of
the operator.

- Read the record: `search_graph`, `read_entity`, `neighbourhood`, `list_vocabulary`,
  `list_proposals`.
- Read the documents: `find_document`, `document_text`, `job_status`.
- Find leads on the web: `web_search`, `news_search`.
<<<<<<< HEAD
- Write: `archive_snapshot`, `fetch_document`, `telegram_channel`, `enqueue_extract`, `start_lead`, `propose`.
=======
- Read a register: `gleif_lookup`, `companies_house`, `wikidata_ids`. Each one stores its answer
  as a document.
- Write: `archive_snapshot`, `fetch_document`, `enqueue_extract`, `start_lead`, `propose`.
>>>>>>> fb64690 (feat(tools): three register lookups store each answer once as an api document)

## Who proposes what

- **The extractor proposes the claims of a document.** The extractor is the back-end AI. When
  you fetch a document, you queue its extraction with `enqueue_extract`. The extractor reads the
  whole text and proposes each claim that it finds.
- **You propose only what the extractor missed.** When the job is done (`job_status`), read its
  proposals with `list_proposals` for the document. Propose a fact only if no pending proposal
  holds it, through `propose`, with the page and the excerpt.
- **The lead agent finds sources for a lead.** For a broad lead, such as a company and its
  vessels, call `start_lead` with a short text. The back-end AI searches the web and the news,
  stores each new page and queues its extraction, with its own tokens. It proposes nothing. Later,
  find the stored pages with `find_document` and their proposals with `list_proposals`. Start a
  lead only for the lead of your ticket.
- **A register lookup gives a document to cite.** When you hold an LEI, a UK company number or a
  Wikidata item id, call `gleif_lookup`, `companies_house` or `wikidata_ids`. Read the stored
  text with `document_text`, and call `propose` with the document id and the excerpt.
  `companies_house` needs a key. When the key is not set, the tool says so, and the other tools
  work.
- **You can propose linked facts in one batch.** For example: a company, its vessels and the
  relations between them. A relation names an entity of an earlier item by its `ref`.

## The rules of a research ticket

1. **The deliverable is data in Gabriel** (#159). A research ticket is done when its facts are in
   Gabriel as stored documents and proposals. A report, a note or a chat answer is not the
   deliverable.
2. **Fetch first. Cite a stored document id, and never a bare URL.** Before you fetch a page,
   call `find_document`: Gabriel can hold it already. Fetch a new page with `fetch_document`. The
   tool stores the page and gives you its document id. Each citation names that id.
3. **Store the document and queue the extraction. Never extract with your own tokens** (ADR
   0010). After the fetch, call `enqueue_extract` with the document id.
4. **A search result is a lead, and not a source** (ADR 0010). A list of search results is not
   stored, and you must not cite it. Fetch the page that the result points to. Only a fetched
   page is a document. A name search in a register is also a lead: read the record by its
   identifier with the lookup tool, and cite the document that it stores.
5. **Use the words of the record.** Call `list_vocabulary` for the entity types, the relation
   types and the identifier keys. Do not make up a type or a key.
6. **ADR 0011 is the authority for ratings and wording.** Do not make a rating table of your own.
   A rating rates the originator only, never a type of claim. For a sanctions status, write only
   the status: "listed by the EU on <date> under Regulation <n>; status checked on <snapshot
   date>". GAB voice never uses "evader", "shadow fleet vessel" or "fraudulent registry" unless an
   issuer text uses the word, with that text cited.
7. **Work in ASD-STE100 Simplified Technical English. Write the deliverables in French** (the
   CARTO plan). Your messages, your notes and your comments on a ticket are in ASD-STE100
   English. The text that goes into Gabriel is in French.
8. **A refusal tells you what to correct.** It names the field, or the item of a batch, and the
   reason. Correct that part and call the tool again once.
