# Documentation index

**For a normal coding task read `spec.md` only.** Read another document when a row below sends you
there.

| Document | Read it when |
|---|---|
| `spec.md` | Always. It holds the invariants, the read path and the write path. |
| `decisions.md` | A document or a source file names an identifier such as `(M8)` or `(T5)`, and you need the reason or the cost. Start at its index. |
| `prd.md` | You need the scope: what Gabriel does, and what it refuses to do. |
| `agents/issue-tracker.md` | You write to GitHub. |
| `agents/domain.md` | You explore the code and you need the domain words. |
| `agents/triage-labels.md` | You apply a triage label. |
| `agents/commit.md` | You write a commit message. |
| `authoring.md` | You write a document, you propose one, or you must decide where a sentence belongs. |
| `deploy.md` | You deploy the read surface, or you point the writer or the worker at a remote database. |

**The surface documents are gone.** `map-surface.md`, `graph-surface.md`, `detail-surface.md` and
`review-surface.md` were build orders taken from accepted prototypes, and the operator removed them
on 17 August 2026: a document that describes a surface which is already built is a record and not
an order, and the repository was carrying too much documentation for a project that is building a
user interface.

**Where their content is now.** The built surfaces carry their rules in the file headers of
`src/features/`. A header states the rule and the defect that produced it. That is the reason, and
ADR 0006 makes it the whole header: the header names no document and no section. The rules of a
surface that is not built moved to the tracker, with the ticket that builds it, before the file
was deleted.
Every document is in git history at `7dc1eba`.

**A source file names no document.** ADR 0006 decides it: a comment records a reason, and never a
reference. A header that cited a deleted document was a citation that outlived its file, and that
is one of the three defects that produced the rule. Read the header itself: it carries the reason.

## Architecture decision records

An ADR records one build decision and its cost. This register is the only list of them.

| ADR | Decision | Status | Read it when |
|---|---|---|---|
| [0001](adr/0001-repository-conventions.md) | Repository conventions | Accepted | You add a folder, you run the check command or the test command, or you declare a change done. |
| [0002](adr/0002-local-runtime.md) | Local runtime and data stores | Accepted | You start the services, you change an image or a port, or you touch the bucket. |
| [0003](adr/0003-schema-pipeline-and-read-contract.md) | Schema pipeline and the read contract | Accepted | You write DDL, you add a read, you add a role or a grant, or you touch a type that describes the database. |
| [0004](adr/0004-frontend-stack.md) | Frontend stack | Accepted | You write a file under `src/`, you add a feature, or you place a piece of view state. |
| [0005](adr/0005-map-and-tile-path.md) | Cartographic library and tile path | Accepted | You render a map, you touch a tile or an imagery source, or you change the `layers` table. |
| [0006](adr/0006-a-comment-records-a-reason.md) | A comment records a reason | Accepted | You write a comment or a file header, or you must decide whether a pointer belongs in the code. |
| [0007](adr/0007-object-store-end-of-life.md) | The object store is SeaweedFS | Accepted | You touch the object store, you change its image, or you meet a fault in it. |
| [0008](adr/0008-the-read-role-carries-no-row-cap.md) | The read role carries no row cap | Accepted | You add a read that returns every row, or you set a row limit on the read role. |
| [0009](adr/0009-the-map-read-resolves-a-borrowed-position.md) | The map read resolves a borrowed position | Accepted | You touch `api.full_map`, you draw or word a position on a surface, or you decide what a missing precision word means. |
| [0010](adr/0010-three-ais-one-tool-catalogue.md) | Three AIs share one tool catalogue, and a source rule decides promotion (§7 replaced by ADR 0011, 4 October 2026) | Accepted | You add a tool, an agent, an MCP surface or a model setting, you touch a job or a role, or you promote or reject a proposal in code. |
| [0011](adr/0011-trust-and-rating-method.md) | A decision table, not a score, decides the public state of each claim, and a letter rates only the originator | Accepted | You rate a source, you decide or word the public state of a claim, you name a person or a company, or you touch an audit, a canary or a legal-gate rule. |

The section numbers of an ADR are cited from one document to another — `authoring.md` cites them,
and the ADRs cite each other — so they are stable. **Keep them stable** when an ADR is edited:
compress a section, and never renumber one. No file under `src/`, under `packages/*/src` or under
`.storybook` cites one, because ADR 0006 removed that. The configuration files at the root still
do, and the tracker carries them.
