# ADR 0010 — Three AIs share one tool catalogue

**Status** Accepted · 3 October 2026 · Promotion rule replaced by ADR 0011, 4 October 2026. A decision
table, not a source rule, now decides promotion.

## Context

The operator does the research with Claude Code and Codex. Gabriel must do the repetitive work on
free tokens. Each tool must be available to the web interface and to each AI. This ADR decides how.

## Three AIs, and each one has one job

| AI | Who runs it | Its job | Tokens |
|---|---|---|---|
| Operator AI | Claude Code, Codex | Research: leads, hypotheses, hard sources, writing | The operator's own |
| Back-end AI | The worker, from a job queue in the database | Ingestion, tagging, extraction, mapping | Free, through a model gateway |
| Front-end AI | A chat route on the local writer | A question in the interface | Free, through a model gateway |

**The cost rule.** Deterministic work is plain code with no model: hash, store, load, text
extraction, a call to a registry API. Repetitive judgement is the back-end AI. Reasoning is the
operator AI. The operator AI never ingests with its own tokens: it stores a document and queues its
extraction.

## One catalogue, and few tools for each back-end agent

The tools package holds each tool once: a checked input, a checked output and one function. A
surface is an adapter and holds no logic. Each back-end agent gives its model only the few tools of
its job, because a small model chooses badly among many tools. The code of the agent holds that
list.

The operator AI reaches the catalogue through an MCP server, with no tool limit, because Claude Code
and Codex are large models. With it, the operator AI can do each action that the research needs. The
MCP tools follow the deep-module rule: few tools, each one a group of related actions. A new
external source is a new catalogue tool and a new action of a group. This ADR fixes no list of
tools.

## Machine roles propose, and only the operator or the rule promotes

Each consumer has its own database role.

- **The operator**, through the interface and the writer, can store, propose and promote.
- **The operator AI**, through the MCP server, has its own research role. It can store a fetched
  document and propose. It cannot promote.
- **The back-end agents** have the agent role. They can store a fetched document, write their own
  outputs and propose. They cannot promote.
- **The promotion rule** runs as the agent role and does only the rule decision. ADR 0011 now holds
  that rule.
- **The chat** reads through the read role and can queue an extraction. It never proposes, because
  a live answer must never become a proposal directly.

**A machine role writes only through narrow doors.** Each door is a database function that writes
one kind of row. No machine role can write a table directly. The grants file in `db/` holds the
doors of each role, and the perimeter tests check them.

**The MCP server never calls the writer.** The writer signs each act as the operator. A call from an
AI through the writer would enter the evidence as an operator act that nothing tells apart.

**The research workspace is separate from the build workspace.** A research session must not read
the operator secret.

## External sources are reached on demand

- A fetch answers at once and uses no model. It stores the bytes, extracts the text and returns
  the text in the same turn, because the research needs the page now. An extraction is queued, and
  the AI follows the job.
- **A list of search results is a lead, and it is not stored.** An API answer that lists
  candidates is a search result, also when the query is an identifier. Only the read of one record
  by its identifier, or one page that is fetched, becomes a document.
- The same bytes are stored once.
- One fetch reads one address. No crawl and no schedule: a person or an AI asks for each fetch.

## The model transport

- A free model gateway is the default endpoint, and a paid router is the switch. The endpoint is a
  setting of each agent.
- **A back-end agent pins one model.** If the served model differs from the requested model, the
  answer is refused. Two models in one job make the extraction inconsistent.
- **Dissent needs a second model family.** The second reader uses a family that differs from the
  first.
- **Each model call is recorded**, so that a disputed claim can be traced to a prompt and a model.
- **A job that fails, fails at once, with its reason.** One operator runs one worker, so the queue
  has no lease and no count of attempts. At its start the worker puts back each job that a crash
  left running. The operator queues a failed document again by hand. A job that runs again writes
  no second set of proposals.

## The chat is local, and the conversations are private

The chat runs on the operator's writer, not on the public deployment. The results are public. The
conversations go in a part of the database that the public read path cannot see.

**Not built.** The chat is not built. Its store of conversations had no caller, and it was removed
on 6 October 2026. The chat feature builds its store again.

## Consequences

- **A claim that the rule promotes is a claim that no person read.** The dataset must tell this for
  each claim, and the agents share their blind spots. No accuracy rate is defensible without an
  audit sample.
- The rule is only as good as the checks and the audit of ADR 0011. A change that lets a model
  write a rating, a state or an audit label reopens ADR 0011.
- The free gateway has no service level. The pinned model and a failure that shows its reason
  contain this risk. They do not remove it. A spent quota fails each job until the gateway has
  quota again, and the operator queues the documents again.
- Two support services are added: the model gateway and a metasearch engine. They hold no record of
  the project and listen on a private address only.
