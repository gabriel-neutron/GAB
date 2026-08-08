# Documentation index

Keep each document in `docs/`. Two files stay at the repository root, because the tools
read them from that path: `README.md` (the public front page) and `CLAUDE.md` (the agent
rules).

## Read this first

For a normal coding task, read `spec.md` only. Go to another document when the table below
sends you there. Do not read the whole folder.

| Document | Lines | Read it when |
|---|---|---|
| `spec.md` | 201 | Always. It holds the invariants, the read path and the write path. |
| `schema.md` | 491 | **Provisional — an example, not the contract.** You need an illustration of how an invariant maps to the database. |
| `decisions.md` | 315 | `spec.md` cites an identifier such as `(M8)` or `(T5)` and you need the reason or the cost. Start at the index table at the top. |
| `prd.md` | 146 | You need the scope: what Gabriel does, and what it refuses to do. |
| `agents/issue-tracker.md` | 71 | You write to GitHub: an issue, a comment, a label. |
| `agents/domain.md` | 61 | You explore the code and you need the domain words. |
| `agents/triage-labels.md` | 6 | You apply a triage label. |

## Architecture decision records

An ADR records one build decision, the reason for it, and the cost of it. The register
below is the only list of them. Write a line in it when you make an ADR.

| ADR | Decision | Status | Read it when |
|---|---|---|---|
| [0001](adr/0001-repository-conventions.md) | Repository conventions | Accepted, v2 | You add a folder, you run the check command or the test command, or you declare a change done. |
| [0002](adr/0002-local-runtime.md) | Local runtime and data stores | Accepted, v1 | You start the services, you change an image or a port, or you touch the bucket. |
| [0003](adr/0003-schema-pipeline-and-read-contract.md) | Schema pipeline and the read contract | Accepted, v1 | You write DDL, you add a read, or you touch a type that describes the database. |

### What is an ADR

Each of the four statements below is true of an ADR. If one of them is false, the document
is not an ADR.

1. The decision is made. An ADR records a choice. It never holds a question.
2. The decision is about the build: how the code is arranged, which tools run, which checks
   run, how the parts are built and how they are deployed.
3. The decision is costly to reverse. The reason for it must outlive the person who made it.
4. No entry in `decisions.md` already settles it.

### What is not an ADR

| The item | Its home |
|---|---|
| An open question | A tracker ticket. Never settle an open question in an ADR. |
| A product decision or a scope decision — what Gabriel does, and what it refuses to do | `decisions.md`, which is locked, and `prd.md` |
| A rule that the system holds on every path | `spec.md` |
| A choice that one afternoon reverses, with no effect on anything else — a lint rule set, a version number, a file name | The configuration file itself. Do not write an ADR for it. |
| A design note, a tutorial, or a summary of how the code works | Nowhere. Write the code so that the code says it. |

### Rules for an ADR

- Number each ADR from 0001 up. Use each number once. Never renumber an ADR.
- Give each ADR a status: **Proposed**, **Accepted**, or **Superseded by ADR NNNN**.
- Prefer one ADR that stays true to two ADRs that disagree. While an ADR has produced no
  code, rewrite it in place and raise its version number.
- Once code exists under an ADR, never change it to say something different. Write a new
  ADR, then set the status of the old one to superseded.
- Name each decision that the ADR replaces. `decisions.md` is locked: an ADR that
  contradicts an entry in it is a fault. Stop, and ask the operator.

## Rules

- A new document in `docs/` must have a line in the first table above before you make it.
- An ADR needs no line in that table. It needs a line in the ADR register instead.
- Keep this index under 200 lines. It is an index, not a document.
- A document longer than 250 lines must have a table of contents.
- Only the operator changes a document in `docs/`. An agent asks first.
