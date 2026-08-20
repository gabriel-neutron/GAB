# Documentation index

**For a normal coding task read `spec.md` only.** Read another document when a row below sends you
there.

| Document | Read it when |
|---|---|
| `spec.md` | Always. It holds the invariants, the read path and the write path. |
| `decisions.md` | A document cites an identifier such as `(M8)` or `(T5)`, and you need the reason or the cost. Start at its index. |
| `prd.md` | You need the scope: what Gabriel does, and what it refuses to do. |
| `agents/issue-tracker.md` | You write to GitHub. |
| `agents/domain.md` | You explore the code and you need the domain words. |
| `agents/triage-labels.md` | You apply a triage label. |
| `authoring.md` | You write a document, you propose one, or you must decide where a sentence belongs. |

**The surface documents are gone.** `map-surface.md`, `graph-surface.md`, `detail-surface.md` and
`review-surface.md` were build orders taken from accepted prototypes, and the operator removed them
on 17 August 2026: three of those surfaces are built, so their documents had become a record, and
the repository was carrying too much documentation for a project that is building a user interface.

**Where their content is now.** The built surfaces carry their rules in the file headers of
`src/features/`, which state the rule and the defect that produced it. The review surface is not
built, so its components and its rules were moved to **#58** before the file was deleted. Every
document is in git history at `7dc1eba`.

A source file that cites a section of a deleted document — `docs/map-surface.md` §4.5 — names a
reason that is still true and a file that is gone. Read the header itself: it carries the rule.

## Architecture decision records

An ADR records one build decision and its cost. This register is the only list of them.

| ADR | Decision | Status | Read it when |
|---|---|---|---|
| [0001](adr/0001-repository-conventions.md) | Repository conventions | Accepted | You add a folder, you run the check command or the test command, or you declare a change done. |
| [0002](adr/0002-local-runtime.md) | Local runtime and data stores | Accepted | You start the services, you change an image or a port, or you touch the bucket. |
| [0003](adr/0003-schema-pipeline-and-read-contract.md) | Schema pipeline and the read contract | Accepted | You write DDL, you add a read, you add a role or a grant, or you touch a type that describes the database. |
| [0004](adr/0004-frontend-stack.md) | Frontend stack | Accepted | You write a file under `src/`, you add a feature, or you place a piece of view state. |
| [0005](adr/0005-map-and-tile-path.md) | Cartographic library and tile path | Accepted | You render a map, you touch a tile or an imagery source, or you change the `layers` table. |

The section numbers of an ADR are cited from source files, so they are stable. **Keep them stable**
when an ADR is edited: compress a section, and never renumber one.
