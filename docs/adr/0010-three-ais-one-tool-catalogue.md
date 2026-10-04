# ADR 0010 — Three AIs share one tool catalogue, and a source rule decides promotion

**Status** Accepted · 3 October 2026

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
| Back-end AI | The worker, from the job table | Ingestion, tagging, extraction, mapping (P6), scoring (S3) | Free, through freellmapi |
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
and `job`. A new external source is a new value of the `source` parameter of `lookup`, with its
own Zod schema, not a new tool. This ADR fixes no tool list. The list changes when the research
needs change. When the AI selects tools badly, a skill or a document in `research/` tells it how
to use them. The tool count does not decrease.

The back-end profiles stay small, because the back-end AI is a small model on free tokens.

### 3. Each consumer has its own database role

| Consumer | Surface | Role | Propose | Store | Promote |
|---|---|---|---|---|---|
| Operator | Interface → writer | `gabriel_app` | yes | `put_document` | yes |
| Claude, Codex | MCP (stdio) | `gabriel_research` (new) | yes | `put_fetched_document` | no |
| Back-end agents | Runner | `gabriel_agent` | yes | `put_fetched_document` | no |
| Promotion rule | Runner | `gabriel_agent` | — | — | `decide_by_rule` only |
| Chat | Writer route | `gabriel_read`, and enqueue through the writer | **no** | no | no |

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

- `jobs.kind`: `store_only`, `extract_text`, `map_structured`. Storing a page no longer starts an
  extraction by itself.
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
  document. Otherwise the corpus fills with result lists.
- `sha256` decides identity before `put_fetched_document`.
- One fetch, one URL. No crawl and no schedule (PRD §5).

### 7. Promotion by an evidence rule (rule v2)

The operator decided rule v2 on 4 October 2026 (#207). Three adversarial reviews (red team,
autonomy, standards editor) replaced the first version. **The rule decides from the quantity and
the quality of the evidence, never from the type of claim. The models prepare the evidence; only
the database decides.**

**The ADMIRALTY digit is an output.** The letter (A–F) rates a source. The digit (1–6) rates one
item of information after corroboration, so the rule computes it on the claim. The digit on a
document is not an input. The 82 seed sources keep digit 6 ("not judged").

**Agents.**

| Agent | Job |
|---|---|
| Two blind extractors, two model families | Each finds the claim and its exact quote without the other. They must agree. If they do not, a third family re-extracts. |
| Span check (code) | The quote is in the stored main text, with two sentences before and after it. Code finds a negation or an attribution ("according to"). |
| Identity check (code) | The quote window holds one strong identifier (IMO, MMSI, LEI, registry number, date of birth) or two weak ones (full name and role or city). |
| Origin tracer | Follows "according to", wire credits and links to the first-hand origin. Sets the access type. An unknown origin joins the earlier group (fail closed). |
| Pro and contra searchers | Same budget each. The contra searcher looks for denials, delistings, sales and court decisions. |
| Verifier, another family | Reads the quotes only, not the extractor's summary. |
| `decide_by_rule` (database) | Decides. |

**Points for each origin, not for each document.** Each independent origin counts once, at its
best citation.

| Access ↓ / letter → | A | B | C | D |
|---|---|---|---|---|
| Primary record of the issuing authority for this fact | 6 | – | – | – |
| Other primary record (leak, copy), or first-hand report | 4 | 3 | 2 | 1 |
| Secondary: repeats another source | 2 | 1 | 1 | 0 |
| No attribution, or letter E or F | 0 | 0 | 0 | 0 |

**Bands.**

| Band | Condition |
|---|---|
| Accept | (a) one primary record of the issuing authority, read the same way by the two extractors, or (b) two or more independent origins of 3 points or more each. And the contra score is below 3, and the verifier agrees. One news report alone never accepts. |
| Supersede a current value | Score 9 or more from three origins, or a primary record of the change. A new dated value is a new period only when the quote holds the date. |
| Wait | The search is short. The rule decides again after 7, 30 and 90 days, and when a new document names the same identifier. After the 30-day retry, the claim goes to the operator. |
| Drop | Score 0 after both searches, or a contra score of 6 or more from two origins against a claim of 3 or less. |
| Operator | A contra score of 3 or more; three families split; `merge_entities`, a deletion or a new key; a value the operator promoted. |

The computed digit: 1 = three origins or more and no contradiction; 2 = accepted; 6 = one origin.

**Anti-planting.** A document published after the claim entered GAB counts 0 for an automatic
acceptance. A fetch keeps the main text only, removes hidden text, and gives it to a model as data
inside a fence.

**Source ratings.** The operator or the source-class table rates a publisher and a path, never a
model (#182, #19). The AI groups unknown domains into patterns, and the operator rates a pattern
once. User-content hosts are always 0. A class rating expires after 12 months, or when the owner
of the domain changes. A rating that would accept more than 10 claims at once sends them to a
batch review. Only issuing authorities and primary data keep the letter A.

**Locks.** `decide_by_rule(p_id)` is a SECURITY DEFINER door. It accepts only when all are true:

1. The parameter rows exist. With no parameter row, the door does nothing. Removing the rows
   stops the rule at once.
2. A counted rating has origin `human` or `class`, never `machine`.
3. The verifier of a second family agrees, after the last citation.
4. The operation is never `merge_entities`, a deletion, or an update that replaces a value the
   operator promoted.
5. The attribute key already exists for that entity type (M11).
6. Each counted citation passes the span check and the identity check.
7. Thresholds go up automatically and go down only by an operator act. Agents can join two
   origins and never split them.

**Measurement.** Before launch: a gold set of 200 claims that the operator checked by hand; the
rule runs on it in shadow mode, and its false accepts must be 1% or less. Each week: the operator
audits a random 5% of the rule accepts (20 at least), by score band and source class. Each month:
20 known-false canary claims; the rule must refuse them. When the false-accept rate goes above 2%,
the threshold of that band goes up by 1; if it stays above 2%, code removes the parameter row.

**Origin.** The door writes `decision_origin = 'rule:<version>'` in a typed column. The public
views show it (S4, PU1). A rule decision is reversed by an inverse proposal built from
`prior_value`.

**Public wording.** The text follows the source and its modality: "Designated by OFAC on …",
"Reuters reported, citing …", "alleged by X". The site never states an allegation as a fact. The
ratings and the number of origins go in a details panel. The contradicting sources show next to
the claim. A report of an error must hold a URL; a reported claim gets "disputed" and stays
visible. Names stay visible. A lawyer reads the wording templates once before launch.

**The operator's work comes in batches:** domain patterns, then documents, then entities, then the
audit sample.

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

1. **Ingest command**: `sha256` deduplication, `put_document`, `jobs.kind = store_only`, and the
   rating door of #19. *The existing reports and the 82 rated sources become documents that a
   claim can cite.*
2. **Research workspace and MCP server**: read, propose, `fetch_document`, the
   `gabriel_research` role. *Claude and Codex work on #159 and cite stored documents.*
3. **Batch promotion (#145).** *The review keeps up with the volume.*
4. **Runner**: `complete_job`, `model_call`, endpoint setting, pinned model, quota pause. *Queued
   extraction of the reports.*
5. **Extractor and verifier agents**, then the mapper (#29). *Proposals at volume, and the data
   that #9 needs.*
6. **Lookup tools of #174**: SearXNG, Wayback, GLEIF, and the others in order. *Wider sources for
   #159.*
7. **#9 calibration**, then `decide_by_rule`. *The review load falls.*
8. **Local chat** with the #18 tables. *W8 and W9 in the interface.*

### 10. Entries this ADR changes

| Entry | Change |
|---|---|
| P1 | The operator, **or the source rule of §7**, moves a proposal to the evidentiary layer. Spec §2 invariant 5, spec §5 (the OPEN branch), PRD §4.3 and W6 follow. |
| #42 resolution | Superseded. "No proposal skips the queue" is true only below the high threshold. #139 and #145 keep it for the review band. |
| S3 | Dissent and the rule score order the review band. This replaces the order of #42. The band edges are the parameters of §7. |
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
- The rule is only as good as the ratings it counts. Lock 2 is the reason the rule can exist at
  all; a change that lets a model's own rating count reopens this ADR.
- freellmapi has no service-level agreement (SLA) and quality falls late in the UTC day. The quota pause and the pinned
  model contain this; they do not remove it.
- Two new services (freellmapi, SearXNG) run on the operator's VPS, on its private network address
  only. The real database, the writer and the worker stay on the operator's machine. The VPS holds
  a disposable test stack for the night build runs, and never the real data.
