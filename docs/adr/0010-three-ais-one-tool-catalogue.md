# ADR 0010 — Three AIs share one tool catalogue

**Status** Accepted · 3 October 2026 · Promotion rule replaced by ADR 0011, 4 October 2026. A decision
table, not a source rule, now decides promotion. · The MCP groups replaced by flat tools, 6 October
2026. · Model transport changed 6 October 2026: a maintained library, the free gateway only, and a
check by a second model family. · The lead agent added 6 October 2026. · Model transport changed
again 7 October 2026: OpenRouter only, with a paid key; the free gateway is gone. · ADR 0011
superseded 7 October 2026: no rule promotes, and the operator decides each proposal. · ADR 0012,
8 October 2026: named rules in the database decide from the letters of the authors, and the
operator decides the doubts. · 8 October 2026: the operator AI can also read the review queue and
accept or reject a unit (#376). · 8 October 2026: the propose tool of the research AI gets the
check by a second model family (#337).

## Context

The operator does the research with Claude Code and Codex. Gabriel must do the repetitive work with
cheap tokens and a hard spend limit. Each tool must be available to the web interface and to each AI. This ADR decides how.

## Three AIs, and each one has one job

| AI | Who runs it | Its job | Tokens |
|---|---|---|---|
| Operator AI | Claude Code, Codex | Research: leads, hypotheses, hard sources, writing | The operator's own |
| Back-end AI | The worker, from a job queue in the database | Ingestion, tagging, extraction, mapping | Paid, through OpenRouter |
| Front-end AI | A chat route on the local writer | A question in the interface | Paid, through OpenRouter |

**The cost rule.** The spend limit is the token cap of each job and a credit limit that the
operator sets on the key in the OpenRouter dashboard. Deterministic work is plain code with no model: hash, store, load, text
extraction, a call to a registry API. Repetitive judgement is the back-end AI. Reasoning is the
operator AI. The operator AI stores each source. In a research layer, it proposes the targeted facts
itself with checked excerpts (P12); the extraction of a whole document stays the back-end AI's job.

## One catalogue, and few tools for each back-end agent

The tools package holds each tool once: a checked input, a checked output and one function. A
surface is an adapter and holds no logic. Each back-end agent gives its model only the few tools of
its job, because a small model chooses badly among many tools. The code of the agent holds that
list.

The operator AI reaches the catalogue through an MCP server, with no tool limit, because Claude Code
and Codex are large models. With it, the operator AI can do each action that the research needs.

**The MCP tools are flat.** Each catalogue tool is one MCP tool, with its own exact input schema
and a hint that says whether it reads or writes. So the permission rules of Claude Code and Codex
allow each read and ask the operator before each write. A group of tools behind one envelope was
tried first: a model guessed the action names and the shape of the input, and a client could not
allow the reads alone. A new external source is a new catalogue tool. This ADR fixes no list of
tools.

- The reads let the AI see the record before it proposes: an entity with its relations and
  sources, the pending proposals, the vocabulary, a stored document, and the jobs of a document.
- No input asks for a value that only a runner knows. The runner gives the record of its model
  call to the propose tool in code, and the door makes the duplicate key from the act.
- **A refusal says what to correct.** A shape refusal names the field and says how to write it. A
  refusal of the record gives the sentence of the rule and its field. A fault of the connection
  or of a role gives its code alone, because its text can name a host or a role.

## Machine roles propose, and the operator AI can decide as a reviewer

Each consumer has its own database role.

- **The operator**, through the interface and the writer, can store, propose, promote and queue an
  extraction.
- **The operator AI**, through the MCP server, has its own research role. It does everything that
  the operator does in the review page: it can store a fetched document, propose, read the review
  queue, and accept or reject a unit or a relation. Its decision records "decided by an AI
  reviewer" and its reason, never "validated manually by the operator". The skills say that the session which
  proposed a unit does not decide it. The database cannot enforce this, because all sessions share
  one role.
- **The back-end agents** have the agent role. They can store a fetched document, write their own
  outputs and propose. They cannot promote or reject, and they cannot start a lead.
- **The decision rules** run in the database (ADR 0012). They promote or reject, and no machine
  role can call their function in place of a rule.
- **The chat** reads through the read role and can queue an extraction. It never proposes, because
  a live answer must never become a proposal directly.

**A machine role writes only through narrow doors.** Each door is a database function that writes
one kind of row. No machine role can write a table directly. The grants file in `db/` holds the
doors of each role, and the perimeter tests check them.

**Every AI proposes through one tool and one door.** The extractor and the research AI call the
same propose tool. A call is a batch of items: each item is one act, the party that first stated
it, how the page states it, and for its values the page and an excerpt copied from the stored text.
The tool finds each excerpt in the page, also when the white space, the Unicode form or a hyphen at
a line end differs, and calculates the offsets. An excerpt that the page does not hold refuses the
whole batch, and the refusal names the item, so the model can correct it once. A value that no
excerpt states, in any form of that value, marks the item as disputed. A form with two readings,
such as 03/04/2024 or 1,000, states no value, so it also marks the item as disputed. A yes or no
needs a word of yes or no, and a negative number needs its minus sign or a word for it. Code mints
the identifier of each item, so a relation names an entity that an earlier item of the same batch
creates. The items that name each other stay one linked batch. The batch is a group: a label and
a filter. A rule or the operator decides one unit of it at a time (ADR 0012): an entity with the relations that depend
on it. The door writes each act with its citations in one transaction, and it holds the rules of the
data: a machine proposes a new entity, a new relation or new attributes and never a change of a name
or a type or a deletion, the page exists, the span lies in it, and a machine act cites at least one
page. A pending act with the same operation, target, payload, sources and role is returned and not
written again, so a retry or a second run writes no duplicate. The door adds to that act each
citation that it does not hold yet. Another role is another witness, and its act stays separate. The
originator does not make a second act, because a model words one party in more than one way: the act
that waits keeps the originator that it was written with. The cited passage is private: the review
card reads it through the writer, and the public read never shows it. **Cost:** a model that cannot
copy a quote word for word loses its claim, and an excerpt proves only that the page holds the
words.

**The MCP server never calls the writer.** The writer signs each act as the operator. A call from an
AI through the writer would enter the evidence as an operator act that nothing tells apart.

**The research workspace is separate from the build workspace.** A research session must not read
the operator secret. Its rules override the build rules of the repository, so a research session
never changes code and never commits. It reaches the object store by its address, so the store
can run on another machine.

## A structured file is mapped by one proposal, and code loads it

A model reads the header and the first rows of a table, and proposes one mapping of its columns.
The operator promotes it. The promotion writes nothing to the graph: it queues the load. Code
then reads every row with no model. Each row is a proposal cited by the span of the row, and a
row and its links are one linked batch, which a rule or the operator decides one unit at a time. A row that
does not fit is left out, and one report
document keeps the reason for each. The rows carry the model call of the mapping, because that
call is the origin of the way the row is read. A new file from the same host with the same header
takes the accepted mapping, and no model reads it.

**Cost:** only a CSV table is mapped. A link to an entity that the record does not hold is not
loaded, and the report says so. A mapping that reads a column wrongly shows only in the
proposals of the rows, which the rules check, and which the operator reads when a rule finds a
doubt.

## External sources are reached on demand

- A fetch answers at once and uses no model. It stores the bytes, extracts the text and returns
  the text in the same turn, because the research needs the page now. The operator AI proposes the
  facts of its layer from the stored text, and queues an extraction only when the operator asks
  for it.
- **A list of search results is a lead, and it is not stored.** An API answer that lists
  candidates is a search result, also when the query is an identifier. Only the read of one record
  by its identifier, or one page that is fetched, becomes a document.
- **A page that refuses the server can come from the browser of the operator.** The research AI
  opens it in the browser on the operator's machine, saves it, and stores the saved file under the
  address of the page. Its bytes are what the browser held after the scripts of the page ran, not
  the answer of the server, so its title says that the browser saved it. A page that shows an
  account of the operator is not saved.
- The same bytes are stored once.
- One fetch reads one address. No crawl and no schedule: a person or an AI asks for each fetch.

## The model transport

- **Every model call goes to OpenRouter, with one paid key.** No other service takes a model call,
  and no local gateway runs. The code reads one variable, `OPENROUTER_API_KEY`.
- **A maintained library makes the calls.** The Vercel AI SDK, with its OpenAI-compatible
  provider, replaces a custom client. Both are free and under the Apache 2.0 licence, and the
  versions are pinned exactly. One small adapter holds the rules of the project: the token budget
  of each job, the network retries with a wait that grows and the wait that OpenRouter asks for,
  one retry with the fault for an answer of a bad shape, and the stops for credits and for a text
  that is too long. **Cost:** a new dependency that changes often, and a library error that the
  adapter does not know stops the job.
- **The adapter sends the routing rules of the project.** Each call asks OpenRouter for
  `data_collection` set to `deny`, so a provider must not keep the prompts or train on them. Each
  call also sets `require_parameters`, so the router picks only a provider that accepts tools and
  the JSON answer format. **Cost:** fewer providers can serve a model, so a call can fail or cost
  more.
- **The adapter takes only a model of OpenRouter.** It takes a chat model that the
  OpenAI-compatible provider made for OpenRouter, and it refuses a model of any other provider. A
  model name is a pinned slug such as vendor/model, and never `auto`.
- **A back-end agent pins one model.** A middleware reads the served model of each answer before
  any tool runs. If it differs from the requested model, the answer is refused. Two models in one
  job make the extraction inconsistent.
- **Each model call is recorded** before the proposal that it leads to is written, so that a
  disputed claim can be traced to a prompt and a model.
- **A model of another family checks each extracted claim.** Before the extractor writes its
  items, the checker reads each item with its passage: the checked excerpt and the words around
  it. It answers supported, not supported or unclear: one question for each passage, one verdict
  for each item. An answer that is not "supported", or a checker that fails, marks the item as
  disputed when it is written, and the mark cannot change later. The item keeps the verdict and
  the short reason of the checker with the mark, as a private note for the review card. The
  record also keeps each verdict as the check of its act, which the rules of ADR 0012 read. A
  failure of the checker never drops an item. The two families are set in the configuration, and
  the worker does not start when they are the same. The propose tool of the research AI gets the
  same check from the MCP server: one question for each batch, under a token cap of its own, from
  a checker of another family than the research AI. The server reads that family from the name of
  its client. A batch above the cap, a checker that fails, or a checker that is not configured
  gives no check, and each item of the batch is disputed with the reason. This check replaces the blind second reading, which wrote rows that
  nothing read. **Cost:** one more call for each passage, from the same token budget, and the
  operator must keep two models of two families available on OpenRouter.
- **A job that fails, fails at once, with its reason.** One operator runs one worker, so the queue
  has no lease and no count of attempts. At its start the worker puts back each job that a crash
  left running. The operator queues a failed document again by hand. A job that runs again writes
  no second set of proposals, because the propose door returns the act that waits.

## The lead agent

The operator, from the interface, or the research AI, through the MCP server, gives a lead: a
short text such as "a company and its vessels". The lead is a job with its text and no document.
A back-end agent runs it with real tool calls: web search, news search, graph search, a search of
the stored documents, fetch, and queue an extraction. The extractor keeps its JSON answers, and
code writes its proposals.

- **It stores and queues, and it proposes nothing.** Code queues the extraction of each page that
  the agent stores, so the claims reach the review queue through the extractor. The agent has no
  propose tool, and its role holds no grant to start a lead, so it starts no lead of its own.
- **It never stores a page twice.** Before each fetch, code looks for the address in the stored
  documents, in the form that the fetch stores: no fragment, and with or without a slash at the
  end of the path. A stored page is not fetched again, and the model reads its document id.
- **It fetches only public addresses.** A search result and a page are untrusted text. The fetch
  refuses an address of the machine or of a private network, so a page cannot send the agent to
  an internal service.
- **A lead setting never stops the extraction.** When a lead setting is absent, the worker starts,
  and each lead fails at once with a reason that names the setting.
- **No page limit, one token budget.** The operator decided that a lead fetches as many pages as
  it needs. The token budget of the job is its one stop, and the job fails with that reason. The
  pages stored before the stop stay stored.
- **The lead is private.** Its text can name a party before a source supports it. Only the operator and the operator AI (through the MCP server) read the leads and what each one stored. The worker reads the text of the one lead that it claims.
- **No schedule.** A person or the research AI starts each lead.

**Cost:** the agent reads only the start of each page, so it can miss a page that a long document
points to. A lead that loops spends its whole budget before it stops.

## The chat is local, and the conversations are private

The chat runs on the operator's writer, not on the public deployment. The results are public. The
conversations go in a part of the database that the public read path cannot see.

**Not built.** The chat is not built. Its store of conversations had no caller, and it was removed
on 6 October 2026. The chat feature builds its store again.

## Consequences

- **Named rules in the database decide most units, and the operator reads only the doubts**
  (ADR 0012). A model gives the letter of an author, and never a state or a verdict.
- OpenRouter has no service level of its own. A provider can fail, and the pinned model and a
  failure that shows its reason contain this risk. They do not remove it. A spent credit balance
  fails each job with a clear reason. The operator adds credit and queues the documents again.
- One support service is added: a metasearch engine. It holds no record of the project and listens
  on a private address only. The model service is external, and it sees the text of each document.
