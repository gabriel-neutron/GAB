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
| research (MCP) | `search_graph`, `neighbourhood`, `document_text`, `web_search`, `fetch_document`, `propose_change`, `enqueue_extract`, `job_status` |
| extractor | `document_text`, `lookup_entity`, `propose_change` |
| mapper (P6) | `file_schema_sample`, `propose_mapping` |
| verifier | `document_text`, `proposal_read`, `vote` |
| chat | `search_graph`, `neighbourhood`, `document_text`, `web_search`, `enqueue_extract` |

A lookup tool of #174 joins a profile only when that profile stays at eight tools or fewer.

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

### 7. Promotion by a source rule, in three bands

The operator decided this on 3 October 2026. **A rule score, computed by the database from the
cited sources, puts each machine proposal in one of three bands:**

| Band | Condition | Effect |
|---|---|---|
| Accept | score ≥ high threshold | Promoted by the rule |
| Review | between the two thresholds | Review queue, in S3 order |
| Drop | score < low threshold | Rejected by the rule |

**The score is the evidence, not the model's opinion of itself.** It counts the independent
sources the proposal cites and the ADMIRALTY rating of each. The minimum count, the minimum
rating and the two thresholds are operational parameters (spec §7). **Two sources on the same
upstream feed count as one** (CARTO plan §4).

**Locks.** `decide_by_rule(p_id)` is a SECURITY DEFINER door. It accepts only when all of these
are true:

1. The parameters exist. **With no parameter row, the door does nothing**, and every proposal
   goes to the queue. The rule is therefore off until #9 sets the values on real data.
2. A cited source counts only if its rating came from the operator or from the source-class table
   (CARTO plan §4), never from a model alone. Otherwise a model rates a document A and then
   promotes its own claim.
3. `dissent = false`, with a verifier vote from a second model family.
4. The operation is never `merge_entities`, never a deletion, and never an update that replaces a
   value the operator promoted.
5. The attribute key already exists for that entity type, so the rule does not create new keys
   (M11).

**Origin.** The door writes `decision_origin = 'rule:<version>'` in a typed column. The public
views show it (S4, PU1). A rule decision is reversed by an inverse proposal built from
`prior_value`. Removing the parameter row stops the rule at once.

### 8. The chat is local and never proposes

The chat runs on the operator's writer, not on the public deployment, which has no write path and
no authentication (C5). It reads through `gabriel_read`, so T4 is not amended. **It never
proposes** (#18: a live answer never becomes a proposal directly), and it ships only with the
#18 tables. It comes last, because MCP already gives Claude and Codex the same tools.

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
| T5 | Two services are added: freellmapi and SearXNG. |

## Consequences

- **A rule-promoted claim is a claim that no person read.** The dataset must say so for each
  claim (PU1), and S3's warning stays true: the agents share their blind spots, and no accuracy
  rate is defensible without an audit sample.
- The rule is only as good as the ratings it counts. Lock 2 is the reason the rule can exist at
  all; a change that lets a model's own rating count reopens this ADR.
- freellmapi has no service-level agreement (SLA) and quality falls late in the UTC day. The quota pause and the pinned
  model contain this; they do not remove it.
- Two new services (freellmapi, SearXNG) run on the operator's machine.
