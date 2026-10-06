# ADR 0010 — Three AIs share one tool catalogue, and a source rule decides promotion

**Status** Accepted · 3 October 2026 · §7 replaced by ADR 0011, 4 October 2026. A decision
table, not a source rule, now decides promotion.

The operator does the research with Claude Code and Codex. Gabriel must do the repetitive work —
ingestion, tagging, extraction — on free tokens, so that these two tools spend no time on it. Each
tool must be available to the web interface and to every AI. This ADR decides how. An adversarial
review of the first proposal, on 3 October 2026, found 21 faults; this text holds the corrected
version.

It **amends P1, S3, S4, PU1, P4, T5, T9a, ADR 0003 §7, #16 and #25**, and it **supersedes the
resolution of #42**.
The list is in §10.

### 1. Three AIs, and each one has one job

| AI | Who runs it | Its job | Tokens |
|---|---|---|---|
| Operator AI | Claude Code, Codex | Research: leads, hypotheses, hard sources, writing | The operator's own |
| Back-end AI | The worker, from the job table | Ingestion, tagging, extraction, mapping (P6), span checks and gate inputs (ADR 0011) | Free, through freellmapi |
| Front-end AI | A chat route on the local writer | A question in the interface (W8, W9) | Free, through freellmapi |

**The cost rule.** Deterministic work is plain code with no model: hash, store, CSV load, PDF
text, a registry API call. Repetitive judgement is the back-end AI. Reasoning is the operator AI.
The operator AI never ingests with its own tokens: it stores a document and queues its extraction.

### 2. One catalogue, and a profile of eight tools or fewer per consumer

`packages/tools` holds every tool once: a Zod input, a Zod output and one function. A surface is
an adapter and holds no logic. Each consumer sees a **profile**, because a small model chooses
badly among many tools:

| Profile | Tools |
|---|---|
| research (MCP) | see "The MCP server" below |
| extractor | `document_text`, `lookup_entity`, `propose_change` |
| mapper (P6) | `file_schema_sample`, `propose_mapping` |
| verifier | `document_text`, `proposal_read`, `vote` |
| chat | `search_graph`, `neighbourhood`, `document_text`, `web_search`, `enqueue_extract` |

**The MCP server.** Amended 4 October 2026 (#200). Claude Code and Codex are large models. The
MCP server gives them one surface with no tool limit. Its purpose: with it, the operator AI can
do every action that the research needs. It reads the graph and the documents, fetches and stores
a document, queries the external sources of #174, proposes a change, and starts and follows a
job. The tools follow the deep-module rule: few tools, each with a small interface and more
parameters. Tools are grouped by purpose, for example `graph`, `document`, `lookup`, `propose`
and `job`. Each group is one MCP tool, and its `action` field names a tool of the catalogue.
Amended 6 October 2026: a new external source is a new catalogue tool, with its own Zod input,
its own Zod output and its own function. On the MCP server it is a new action of the `lookup`
group, or of the `document` group when it reads and stores a post or a page (`telegram_channel`).
The client still sees one `lookup` tool. The profile limit of eight tools does not apply to the
MCP server. This ADR fixes no tool list. The list changes when the research
needs change. When the AI selects tools badly, a skill or a document in `research/` tells it how
to use them. The tool count does not decrease.

The back-end profiles stay small, because the back-end AI is a small model on free tokens.

### 3. Each consumer has its own database role

| Consumer | Surface | Role | Propose | Store | Promote |
|---|---|---|---|---|---|
| Operator | Interface → writer | `gabriel_app` | yes | `put_document` | yes |
| Claude, Codex | MCP (stdio) | `gabriel_research` (new) | yes | `put_fetched_document`, and narrow doors (below) | no |
| Back-end agents | Runner | `gabriel_agent` | yes | `put_fetched_document`, and narrow doors (below) | no |
| Promotion rule | Runner | `gabriel_agent` | — | — | `decide_by_rule` only |
| Chat | Writer route | `gabriel_read`, and enqueue through the writer | **no** | no | no |

**A machine role writes only through narrow doors.** Amended 6 October 2026. Next to
`put_fetched_document`, `gabriel_research` and `gabriel_agent` can hold other SECURITY DEFINER
doors. Each door writes one kind of row, for example `put_telegram_post`, `put_claim_reading` or
`put_load_report`. No machine role holds a grant to write a table directly.
`db/apply/90_grants.sql` holds the full list of doors for each role, and the perimeter tests
check it. A new door needs no change to this table.

**The MCP server never calls `/write/*`.** A writer door signs as the operator
(`packages/writer/src/sign.ts`), so a call from Claude through it would enter the evidentiary
layer as an operator act that nothing tells apart.

**`put_fetched_document` is a new, narrow door.** `put_document` is granted to `gabriel_app` only.
The new door requires the bytes, `sha256`, `uri` and `retrieved_at`, and refuses a second row for
the same `sha256`.

**The research workspace is separate from the build workspace.** It is a `research/` folder with
its own `AGENTS.md` (the one source of the research rules, read by Codex), a `CLAUDE.md` that
imports it, its own MCP configuration and its own environment file. The research sessions must
not read `infra/.env`, which holds the operator secret. The operator sets the deny rules of that
workspace; this ADR only requires them.

### 4. The model transport

- freellmapi is the default endpoint, and OpenRouter is the paid switch. The endpoint is a
  setting of each agent, next to `model`. **This amends #25**, which chose OpenRouter.
- **A back-end agent pins one model and never uses `auto`.** If the served model differs from the
  requested model, the answer is refused. Two models in one job make the extraction inconsistent
  and turn dissent into noise.
- **Dissent needs a second model family.** The verifier is pinned to a family that differs from
  the extractor (#25 item 4).
- **A `model_call` table lands in the same change as the first agent**: agent version, requested
  model, served model, tokens, latency, outcome. P4 already requires the emitting agent; without
  this table a disputed claim cannot be traced to a prompt or a model.
- Zod at the boundary (T6) stays the only check of structure. The gateway checks only that JSON
  parses.

### 5. The job table grows a kind, an end and a pause

- `jobs.kind` (amended 6 October 2026). Storing a page no longer starts an extraction by itself.
  Each kind is one step of the pipeline:
  - `store_only`: the document is stored, and no work follows.
  - `extract_text`: the extractor (reader 1) reads the text of one document and proposes claims.
  - `map_structured`: the mapper proposes one mapping for each table of a structured file (P6).
  - `second_read`: reader 2, of another model family, reads the same chunks blind (ADR 0011
    §3.1).
  - `load_mapped`: code loads the rows of a file under a promoted mapping, with no model (P6).
  - `evidence_check`: code runs the span, identity and date checks of each citation, with no
    model (ADR 0011 §3.1, §5).
- A `complete_job` door. Today only `fail_job` ends a job.
- **A quota pause spends no attempt.** The runner asks the gateway for quota before it claims. An
  exhausted quota pauses the runner; it does not fail the job. **This amends T9a.**
- The claim lease is longer than the worst case of one job, waits included.
- An idempotency key — document, agent version, chunk hash — stops a requeued job from writing a
  second set of proposals.

### 6. A fetch answers at once, and an extraction is queued

- `fetch_document` is synchronous and uses no model. It stores the bytes, extracts the text and
  returns the text and the document id in the same turn. The research loop needs the page now.
- Extraction is asynchronous: `enqueue_extract`, then `job_status`.
- **A search result list is a lead and is not stored.** Only a page that is fetched becomes a
  document. Otherwise the corpus fills with result lists. Amended 6 October 2026: an API answer
  that lists candidates is a search result, also when the query is an identifier. Examples: a
  GLEIF or Companies House name search, and the OpenSanctions `/match` answer for a name or for
  an IMO number. Only the read of one record by its identifier is stored (a LEI record, a company
  number, an OpenSanctions entity).
- `sha256` decides identity before `put_fetched_document`.
- One fetch, one URL. No crawl and no schedule (PRD §5).

### 7. Promotion by rule: ADR 0011 replaces the score and the bands

**ADR 0011 (4 October 2026) replaces the rule score and the three bands** with an ordered decision
table. The gate reads anchors and independent origin groups, with no score and no weights. The
ADMIRALTY letter and digit are internal tags that no gate reads. These parts of §7 stay:

- no parameter row = rule off (ADR 0011 L11), and a second model family (ADR 0011 §3.1);
- the rule never merges, never deletes, never replaces an operator value, never adds a key;
- `decide_by_rule(p_id)` is a SECURITY DEFINER door that writes `decision_origin = 'rule:<version>'`
  in a typed column, and an inverse proposal from `prior_value` reverses a rule decision.

### 8. The chat is local and never proposes

The chat runs on the operator's writer, not on the public deployment, which has no write path and
no authentication (C5). It reads the graph through `gabriel_read`. **It never
proposes** (#18: a live answer never becomes a proposal directly), and it ships only with the
#18 tables. It comes last, because MCP already gives Claude and Codex the same tools.

**The results are public, and the conversations are private.** Amended 4 October 2026 (#211).
All the data is in the deployed database: there is no second database. The #18 tables
(conversations, messages, their citations) and the other working data that a result does not
need are in a schema that the `api` views do not expose. `gabriel_read` has no grant on it. The
public site and the public API therefore read only the results. The writer reads the conversations
as `gabriel_app`, on the operator's machine or for a person to whom the operator gives the writer
credentials. This amends T4: the writer also serves the reads of the private data.

### 9. Build order

Each step names what it unblocks for the research.

1. **Ingest command**: `sha256` deduplication, `put_document`, `jobs.kind = store_only`, and
   `load:originators` (ADR 0011 §7.1). *The existing reports become documents that a claim can cite, and the 82
   rated sources become originators with operator letters; their documents carry no rating
   (ADR 0011 §7.1).*
2. **Research workspace and MCP server**: read, propose, `fetch_document`, the
   `gabriel_research` role. *Claude and Codex work on #159 and cite stored documents.*
3. **Batch promotion (#145).** *The review keeps up with the volume.*
4. **Runner**: `complete_job`, `model_call`, endpoint setting, pinned model, quota pause. *Queued
   extraction of the reports.*
5. **Extractor and verifier agents**, then the mapper (#29). *Proposals at volume, and the data
   that #9 needs.*
6. **Lookup tools of #174**: SearXNG, Wayback, GLEIF, and the others in order. *Wider sources for
   #159.*
7. **#220 calibration**, then `decide_by_rule`. *The review load falls.*
8. **Local chat** with the #18 tables. *W8 and W9 in the interface.*

### 10. Entries this ADR changes

| Entry | Change |
|---|---|
| P1 | The operator, **or the decision table of ADR 0011 §8** (this ADR §7), moves a proposal to the evidentiary layer. Spec §2 invariant 5, spec §5 (the OPEN branch), PRD §4.3 and W6 follow. |
| #42 resolution | Superseded. "No proposal skips the queue" is true only for a claim that no open gate path of ADR 0011 §8 accepts. #139 and #145 keep it for those claims. |
| S3 | The sort keys of ADR 0011 §10.1 step 6 (exposure, harm class, search gaps) order the queue, with no score. This replaces the order of #42. The parameters are the parameter rows of ADR 0011 §8 and §12. |
| S4, PU1 | The decision origin is a typed column, published and labelled. |
| ADR 0003 §7 | A fifth role, `gabriel_research`. New grants: `put_fetched_document`, `decide_by_rule`. |
| P4, #16 | `model_call` lands with the first agent. |
| #25 | freellmapi by default, OpenRouter as the switch, pinned models, a second family for dissent. |
| T9a | Quota pause, `complete_job`, lease rule, `jobs.kind`. |
| T4 | The writer also serves the reads of the private data: the #18 conversations (§8). The public read path stays the only reader of the results. |
| T5 | Two services are added: freellmapi and SearXNG. They hold no record of the project, run on the operator's VPS, and listen on its private network address only (`infra/vps/`). |

## Consequences

- **A rule-promoted claim is a claim that no person read.** The dataset must say so for each
  claim (PU1), and S3's warning stays true: the agents share their blind spots, and no accuracy
  rate is defensible without an audit sample.
- The rule is only as good as the register cards, the span checks and the audit (ADR 0011). A
  change that lets a model write a letter, a state, a flag or an audit label reopens ADR 0011.
- freellmapi has no service-level agreement (SLA) and quality falls late in the UTC day. The quota pause and the pinned
  model contain this; they do not remove it.
- Two new services (freellmapi, SearXNG) run on the operator's VPS, on its private network address
  only. The real database, the writer and the worker stay on the operator's machine. The VPS holds
  a disposable test stack for the night build runs, and never the real data.
