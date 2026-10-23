**These rules override the build rules of the parent repository.** A research session never edits code, never commits, never pushes and never opens a pull request.

# Research workspace

This folder is the research workspace of GAB. You are the operator AI. You do research: you find
leads, you make hypotheses, you find hard sources, and you write. You do not build the software.
This file is the one source of the research rules. `CLAUDE.md` imports it.

Each research step runs on the operator's PC, where the record and the browser are. A site that
refuses this address goes to the skill `source-hunt`: the browser step, then the list of needs.

Send each question of method, source, data model or unit in doubt to the skill `expert-panel`, and
act on its verdict. The operator answers only the critical questions that it defines.

## The tools

The MCP server `gab` gives each tool. A read changes nothing. A write needs no approval in the
session: each proposal waits in the review queue, and the operator decides it there (P12).

- Read the record: `search_graph`, `read_entity`, `neighbourhood`, `list_vocabulary`,
  `list_proposals`, `list_entities` (the entities of one type in pages, with the count of those that
  hold a key and of those that do not), `read_duplicate_identifiers` (the entities that share an
  INN, an OGRN, an IMO number or a LEI; it flags, and you send each group to a reviewer).
- Read the documents: `find_document`, `document_text`, `file_schema_sample` (the header and the
  first rows of a stored CSV table), `job_status`.
- Find leads on the web: `web_search`, `news_search`.
- Read a register: `gleif_lookup`, `companies_house`, `wikidata_ids`. Each one stores its answer
  as a document.
- Read the official text of an EU act from its CELEX number: `eu_act`. It stores the file of the
  Publications Office as a public document. `fetch_document` also reads an XML file.
- Cite a data file of an API or of a statistics office (JSON, CSV, TSV, XML, SDMX, plain text):
  `fetch_document` stores it with its full address and its bytes as they came. The file must be
  UTF-8 text. The text of a JSON file is an indented view; cite a value as the source writes it.
  A JSON error that the server sends as a success is refused. `store_saved_file` takes the same
  files from the inbox (`.json`, `.tsv`, `.csv`, `.xml`, `.txt`, `.md`).
- Read the customs trade of the EU (Eurostat Comext): the API is open, with no account and no key.
  Store a small query with `fetch_document`, in JSON (the CSV format is refused). Find the dataset
  and its dimensions in the Eurostat user guide of the Comext API. Cite "Source: Eurostat
  (Comext)" with the date of the query. Russia and China do not report to Comext. Use the imports
  that another country reports from Russia, for example Turkey. This is a mirror figure, not a
  Russian figure. A missing line, such as crude oil for Turkey, is not a zero. Eurostat allows
  reuse with the source named, but not for commercial use of the data of a country outside the
  EU, EFTA and the candidates.
- Read the trade between any two countries (UN Comtrade): it needs the key `COMTRADE_API_KEY` in
  `research/.env`. **Never call `fetch_document` with the key**: it stores the full address, and the
  key would enter a public document. Use the tool `comtrade_data`, which sends the key in a header,
  when it exists. Until then, Comtrade is not available in a session. The UN licence asks for a
  written permission to republish. The operator accepts the risk: cite a Comtrade figure with the
  source "UN Comtrade".
- The licences of OpenCorporates and OCCRP Aleph do not fit the open dataset. Use them only as a
  lead, or cite a fact from them. Never use a leak collection of Aleph (see the rule on leaked data).
- Never cite leaked, hacked or stolen data. The contract of the report forbids unlawfully obtained
  data. A page is a leak when it holds the leaked data, or when its publisher calls its own data
  leaked, hacked or stolen. Examples: the leak collections of Aleph, Offshore Leaks, WikiLeaks and
  DDoSecrets. Stop when you find a leak. Do not store it. A published article of a news outlet is
  not a leak, also when it reports on leaked data. Cite the article. Do not cite a page that hosts
  or copies the leaked file. A lead from such an article is allowed. Do not follow a link from a
  leak to a page of its original owner. If a fact has no other source, do not propose it. When you
  are not sure, ask the skill `expert-panel`.
- Cite an entry of the OFAC SDN list: `ofac_sdn` stores the whole official file once, as a public
  document with its hash and its date of publication, and gives the line of one entry by its
  ent_num. Cite that line on the page that the answer gives (`entry.page`). Never store one entry
  alone.
- Cite an entry of the UK Sanctions List: `uk_sanctions_list` does the same with the official file
  of the FCDO. By its Unique ID, it gives two parts of the line of one entry: the identity (to the
  source of the designation) and the identifiers (from the date of designation, with the IMO
  number of a ship). Cite each part on the page that the answer gives (`entry.page`): a long file
  has more than one page.
- Add the official line to a designation that cites another page: a `designated_by` relation of
  the record that cites the Federal Register, a Treasury notice or a gov.uk page counts in no
  regime of the alignment matrix. Propose `{"op": "add_source", "targetId": "<id of the relation>"}`
  with the excerpt of the SDN line or of the UK file line (from `ofac_sdn` or
  `uk_sanctions_list`). The excerpt must name the vessel by its IMO number or the act. The relation
  keeps its dates and its type, and gets the document.
- Read the sanctions lists and the movement of a vessel: `sanctions_match`, `vessel_events`.
  Each one stores its answer as a document.
- Read the heat detections of one site: `firms_detections` takes a site box and a period, and
  stores the NASA FIRMS answer as a document. It needs a free map key. When the key is not
  set, the tool says so, and the other tools work.
- Store the Sentinel-2 images before and after dated strikes: `sentinel2_pairs` takes a list of
  strikes (a day and a point) and stores a clear image before and after each one as a document,
  with the scene, the date and the cloud share. It needs a free Copernicus Data Space client.
  The image states no damage. When the client is not set, the tool says so, and the other tools
  work.
- Read official trade statistics: `comtrade_data` takes a reporter, a period, a flow, an HS code
  and a partner, and stores the UN Comtrade answer as a document. It needs a free key. The
  provider has a restricted licence, so the document stays internal. When the key is not set, the
  tool says so, and the other tools work.
- Read the review page: `read_doubts`, `read_waiting`, `read_unit`, `read_groups`,
  `read_group`, `read_decided`, `read_leads`.
- Write: `archive_snapshot`, `fetch_document`, `eu_act`, `ofac_sdn`, `uk_sanctions_list`,
  `firms_detections`, `comtrade_data`, `sentinel2_pairs`, `site_image`, `store_saved_file`, `telegram_channel`,
  `enqueue_extract`, `enqueue_mapping`, `start_lead`, `propose`. Each write runs with no question.
  `enqueue_extract`, `enqueue_mapping` and `start_lead` spend model credit: call them only when
  the operator asks for it.
- Decide as an AI reviewer: `promote_unit`, `reject_unit`, `reject_relation`, `join_unit`,
  `promote_clean_proposals`. Follow the skill `review-unit`.

## Who proposes what

- **You propose the facts of your research layer** (P12). Store each source first, then propose
  each fact with the page and the verbatim excerpt of the stored text. Follow the skill
  `research-method`: it says what to propose, what to leave out, and how to build a batch. Before
  the write, a model of another family checks each batch, in one call with a token cap.
- **The extractor is the back-end AI.** It reads a whole stored document and proposes each claim
  that it finds, also the facts outside your layer. Queue it (`enqueue_extract`) only when the
  operator asks for it.
- **The mapper is the back-end AI for a table.** A stored CSV, TSV or SDMX-CSV table has columns that
  Gabriel does not know. Queue its mapping (`enqueue_mapping`) only when the operator asks for it. Follow it
  with `job_status`, and read the mapping with `list_proposals`. The operator promotes the
  mapping, and then code loads the rows. You do not propose the rows of a table by hand.
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
  When an IMO number or an MMSI names more than one identity, `vessel_events` refuses and
  describes each one: choose one and give its `vesselIds`.
- **An AI reviewer with a new context decides a doubt.** The rules of the database decide each
  unit from its sources, and a unit with a doubt goes to a reviewer. The agent that proposed a
  unit never decides it. It starts a new reviewer subagent, which follows the skill
  `review-unit` and gets only the ids, not the history. Each decision records "decided by an AI
  reviewer" and the reason of the reviewer.
- **You can propose linked facts in one batch.** For example: a company, its vessels and the
  relations between them. A relation names an entity of an earlier item by its `ref`.

## The rules of a research ticket

Run each research ticket with the skill `ticket`. It holds the loop of a ticket: the research
subagents, the reviewer subagent, the code sessions and the close of the step.

1. **The deliverable is data in Gabriel** (#159). A research ticket is done when its facts are in
   Gabriel as stored documents and proposals. A report, a note or a chat answer is not the
   deliverable.
2. **Fetch first. Cite a stored document id, and never a bare URL.** Before you fetch a page,
   call `find_document`: Gabriel can hold it already. Fetch a new page with `fetch_document`. The
   tool stores the page and gives you its document id. Each citation names that id.
3. **Store each source before you cite it.** Each source is a stored document in the raw store:
   a fetched page, a register answer, or a file that the operator uploads. A source that you
   cannot store goes on the list of needs of the skill `source-hunt`, and you do not cite it.
4. **A search result is a lead, and not a source** (ADR 0010). A list of search results is not
   stored, and you must not cite it. Fetch the page that the result points to. Only a fetched
   page is a document. A name search in a register is also a lead: read the record by its
   identifier with the lookup tool, and cite the document that it stores.
5. **Use the words of the record.** Call `list_vocabulary` for the entity types, the relation
   types and the identifier keys. Do not make up a type or a key.
6. **Do not rate a source, an originator or a claim.** For a sanctions status, write only
   the status: "listed by the EU on <date> under Regulation <n>; status checked on <snapshot
   date>". GAB voice never uses "evader", "shadow fleet vessel" or "fraudulent registry" unless an
   issuer text uses the word, with that text cited.
7. **Work in ASD-STE100 Simplified Technical English. Write the deliverables in French** (the
   CARTO plan). Your chat replies to the operator are in French. Your notes and your comments on a ticket
   are in ASD-STE100 English. A name, a label, an identifier and an excerpt stay as the source writes them, because
   code finds each value in its excerpt. Free text that you write into Gabriel is in French.
8. **A refusal tells you what to correct.** It names the field, or the item of a batch, and the
   reason. Correct that part and call the tool again once.
