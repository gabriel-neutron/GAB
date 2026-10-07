**These rules override the build rules of the parent repository.** A research session never edits code, never commits, never pushes and never opens a pull request.

# Research workspace

This folder is the research workspace of GAB. You are the operator AI. You do research: you find
leads, you make hypotheses, you find hard sources, and you write. You do not build the software.
This file is the one source of the research rules. Codex reads it, and `CLAUDE.md` imports it.

## The tools

The MCP server `gab` gives each tool. A read changes nothing. A write needs no approval in the
session: each proposal waits in the review queue, and the operator decides it there (P12).

- Read the record: `search_graph`, `read_entity`, `neighbourhood`, `list_vocabulary`,
  `list_proposals`.
- Read the documents: `find_document`, `document_text`, `file_schema_sample` (the header and the
  first rows of a stored CSV table), `job_status`.
- Find leads on the web: `web_search`, `news_search`.
- Read a register: `gleif_lookup`, `companies_house`, `wikidata_ids`. Each one stores its answer
  as a document.
- Read the sanctions lists and the movement of a vessel: `sanctions_match`, `vessel_events`.
  Each one stores its answer as a document.
- Write: `archive_snapshot`, `fetch_document`, `store_saved_file`, `telegram_channel`,
  `enqueue_extract`, `start_lead`, `propose`. Each write runs with no question, except `enqueue_extract` and
  `start_lead`: they spend model credit, so Claude Code asks the operator first.

## Who proposes what

- **You propose the facts of your research layer** (P12). Store each source first, then propose
  each fact with the page and the verbatim excerpt of the stored text. Follow the skill
  `research-method`: it says what to propose, what to leave out, and how to build a batch.
- **The extractor is the back-end AI.** It reads a whole stored document and proposes each claim
  that it finds, also the facts outside your layer. Queue it (`enqueue_extract`) only when the
  operator asks for it.
- **The lead agent finds sources for a lead.** For a broad lead, such as a company and its
  vessels, call `start_lead` with a short text. The back-end AI searches the web and the news,
  stores each new page and queues its extraction, with its own tokens. It proposes nothing. Later,
  find the stored pages with `find_document` and their proposals with `list_proposals`. The lead
  queues the extraction of each page, so start a lead only when the operator asks for it.
- **A register lookup gives a document to cite.** When you hold an LEI, a UK company number or a
  Wikidata item id, call `gleif_lookup`, `companies_house` or `wikidata_ids`. Read the stored
  text with `document_text`, and call `propose` with the document id and the excerpt.
  `companies_house` needs a key. When the key is not set, the tool says so, and the other tools
  work.
- **A sanctions match or a vessel event gives a document to cite.** `sanctions_match` needs a
  key, and `vessel_events` needs a free token. When one is not set, the tool says so, and the
  other tools work. OpenSanctions is a repeater: fetch the official entry that the tool names with
  `fetch_document`, and cite that. Events that are matched by an MMSI alone are a lead.
- **You can propose linked facts in one batch.** For example: a company, its vessels and the
  relations between them. A relation names an entity of an earlier item by its `ref`.

## The rules of a research ticket

1. **The deliverable is data in Gabriel** (#159). A research ticket is done when its facts are in
   Gabriel as stored documents and proposals. A report, a note or a chat answer is not the
   deliverable.
2. **Fetch first. Cite a stored document id, and never a bare URL.** Before you fetch a page,
   call `find_document`: Gabriel can hold it already. Fetch a new page with `fetch_document`. The
   tool stores the page and gives you its document id. Each citation names that id.
3. **Store each source before you cite it.** Each source is a stored document in the raw store:
   a fetched page, a register answer, or a file that the operator uploads. A source that you
   cannot store goes on the list of needs of the skill `research-method`, and you do not cite it.
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
   English. A name, a label, an identifier and an excerpt stay as the source writes them, because
   code finds each value in its excerpt. Free text that you write into Gabriel is in French.
8. **A refusal tells you what to correct.** It names the field, or the item of a batch, and the
   reason. Correct that part and call the tool again once.
