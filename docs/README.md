# Documentation index

**For a normal coding task read `spec.md` only.** Read another document when a row below sends
you there.

| Document | Read it when |
|---|---|
| `spec.md` | Always. It holds the invariants, the read path and the write path. |
| `decisions.md` | A document cites an identifier such as `(M8)` or `(T5)`, and you need the reason or the cost. Start at its index. |
| `prd.md` | You need the scope: what Gabriel does, and what it refuses to do. |
| `schema.md` | You need an illustration of how an invariant maps to the database. It is **provisional**: an example, and never the contract. |
| `graph-surface.md` | You build or change the graph view. It is a build order, taken from an accepted prototype. |
| `map-surface.md` | You build or change the map view. It is a build order, taken from an accepted prototype. |
| `detail-surface.md` | You build or change the entity detail page or its sidebar. It is a build order, taken from an accepted prototype. |
| `review-surface.md` | You build or change the review queue, where a proposal is promoted or rejected. It is a build order, taken from an accepted prototype. |
| `agents/issue-tracker.md` | You write to GitHub. |
| `agents/domain.md` | You explore the code and you need the domain words. |
| `agents/triage-labels.md` | You apply a triage label. |
| `agents/wayfinder-tracker.md` | A wayfinder skill is installed, and it names a map, a child ticket, a blocker or the frontier. |
| `authoring.md` | You write a document, you propose one, or you must decide where a sentence belongs. |

## Architecture decision records

An ADR records one build decision, its reason and its cost. This register is the only list of
them.

| ADR | Decision | Status | Read it when |
|---|---|---|---|
| [0001](adr/0001-repository-conventions.md) | Repository conventions | Accepted | You add a folder, you run the check command or the test command, or you declare a change done. |
| [0002](adr/0002-local-runtime.md) | Local runtime and data stores | Accepted | You start the services, you change an image or a port, or you touch the bucket. |
| [0003](adr/0003-schema-pipeline-and-read-contract.md) | Schema pipeline and the read contract | Accepted | You write DDL, you add a read, you add a role or a grant, or you touch a type that describes the database. |
| [0004](adr/0004-frontend-stack.md) | Frontend stack | Accepted | You write a file under `src/`, you add a feature, or you place a piece of view state. |
| [0005](adr/0005-map-and-tile-path.md) | Cartographic library and tile path | Accepted | You render a map, you touch a tile or an imagery source, or you change the `layers` table. |
