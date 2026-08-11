# Documentation index

Every document lives in `docs/`. Only `README.md` and `CLAUDE.md` stay at the root.

## Read this first

For a normal coding task read `spec.md` only. Read another when the table sends you there.

| Document | Read it when |
|---|---|
| `spec.md` | Always. It holds the invariants, the read path and the write path. |
| `schema.md` | **Provisional — an example, not the contract.** You need an illustration of how an invariant maps to the database. |
| `decisions.md` | `spec.md` cites an identifier such as `(M8)` or `(T5)` and you need the reason or the cost. Start at its index. |
| `prd.md` | You need the scope: what Gabriel does, and what it refuses to do. |
| `graph-surface.md` | You build or change the graph view. It is a build order, taken from an accepted prototype. |
| `map-surface.md` | You build or change the map view. It is a build order, taken from an accepted prototype. |
| `detail-surface.md` | You build or change the entity detail page or its sidebar. It is a build order, taken from an accepted prototype. |
| `review-surface.md` | You build or change the review queue, where a proposal is promoted or rejected. It is a build order, taken from an accepted prototype. |
| `agents/issue-tracker.md` | You write to GitHub. |
| `agents/domain.md` | You explore the code and you need the domain words. |
| `agents/triage-labels.md` | You apply a triage label. |

## Architecture decision records

An ADR records one build decision, its reason and its cost. This register is the only list of
them. Add a line when you make one.

| ADR | Decision | Status | Read it when |
|---|---|---|---|
| [0001](adr/0001-repository-conventions.md) | Repository conventions | Accepted, v4 | You add a folder, you run the check command or the test command, or you declare a change done. |
| [0002](adr/0002-local-runtime.md) | Local runtime and data stores | Accepted, v1 | You start the services, you change an image or a port, or you touch the bucket. |
| [0003](adr/0003-schema-pipeline-and-read-contract.md) | Schema pipeline and the read contract | Accepted, v4 | You write DDL, you add a read, you add a role or a grant, or you touch a type that describes the database. |
| [0004](adr/0004-frontend-stack.md) | Frontend stack | Accepted, v1 | You write a file under `src/`, you add a feature, or you place a piece of view state. |
| [0005](adr/0005-map-and-tile-path.md) | Cartographic library and tile path | Accepted, v1 | You render a map, you touch a tile or an imagery source, or you change the `layers` table. |

**A document is an ADR when all four are true.** The decision is made, not asked. It is about
the build. It is costly to reverse. No entry in `decisions.md` already settles it.

**These are not ADRs.** An open question — a tracker ticket. A scope decision — `decisions.md`
and `prd.md`. A rule held on every path — `spec.md`. A reversible choice — a configuration file.

## Rules

- Number ADRs from 0001 up. Use each number once, and never renumber one. Status is
  **Proposed**, **Accepted**, or **Superseded by ADR NNNN**.
- Rewrite an ADR in place and raise its version while it has produced no code. Once code
  exists, write a new ADR and supersede the old one.
- Name every decision an ADR replaces. `decisions.md` is locked, so an ADR that contradicts an
  entry is a fault: stop and ask the operator.
- An ADR cites a **closed** ticket only, and only when it adds something the ADR does not say.
  For an open question write "the tracker carries it", and name no number.
- A new document needs a line in the first table; an ADR needs one in the register instead.
  Only the operator changes a document in `docs/`. An agent asks first.
