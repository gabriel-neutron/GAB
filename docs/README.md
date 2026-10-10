# Documentation index

| Document | Owner | Read it when |
|---|---|---|
| `prd.md` | Operator | You need the purpose, the uses, or what Gabriel refuses to do. |
| `decisions.md` | Operator | A file names a product rule such as M8 or P1, or you need its reason. |
| `spec.md` | Agent | You need the general view: the parts, who can do what, the rules on every path. |
| `deploy.md` | Agent | You deploy the read surface, or point the writer at a remote database. |
| `authoring.md` | Agent | You write or change a document. |
| `agents/issue-tracker.md` | Agent | You write to GitHub. |
| `agents/domain.md` | Agent | You need the domain words, or your change disagrees with a decision. |
| `agents/triage-labels.md` | Agent | You apply a triage label. |
| `agents/commit.md` | Agent | You write a commit message. |

The code is the source of truth for every detail. `CODING_STANDARDS.md`, at the root, holds the
rules of the code review.

## Architecture decision records

| ADR | Decision | Status |
|---|---|---|
| [0001](adr/0001-repository-conventions.md) | Repository conventions | Accepted |
| [0002](adr/0002-local-runtime.md) | Local runtime and data stores | Accepted |
| [0003](adr/0003-schema-pipeline-and-read-contract.md) | Schema pipeline and the read contract | Accepted |
| [0004](adr/0004-frontend-stack.md) | Frontend stack | Accepted |
| [0005](adr/0005-map-and-tile-path.md) | Cartographic library and tile path | Accepted |
| [0006](adr/0006-a-comment-records-a-reason.md) | A comment records a reason | Accepted |
| [0007](adr/0007-object-store-end-of-life.md) | The object store is SeaweedFS | Accepted |
| [0008](adr/0008-the-read-role-carries-no-row-cap.md) | The read role carries no row cap | Accepted |
| [0009](adr/0009-the-map-read-resolves-a-borrowed-position.md) | The map read resolves a borrowed position | Accepted |
| [0010](adr/0010-three-ais-one-tool-catalogue.md) | Three AIs share one tool catalogue | Accepted |
| [0011](adr/0011-trust-and-rating-method.md) | A decision table decides the public state of a claim; a letter rates only the originator | Superseded by 0012 |
| [0012](adr/0012-rules-decide-from-the-letters-of-the-authors.md) | Named rules in the database decide from the letters of the authors | Accepted |
| [0013](adr/0013-a-release-is-a-dated-folder-of-files.md) | A release is a dated folder of files, read through the release functions | Accepted |
