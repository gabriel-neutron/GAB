# Documentation map

Read a document only when its row matches your task. The code is the source of truth for every
detail. Find a decision record with `ls docs/adr`; open one only when a file or a document cites it.

| Document | Owner | Read it when |
|---|---|---|
| `prd.md` | Operator | You need the purpose, the uses, or what Gabriel refuses to do. |
| `decisions.md` | Operator | A file names a product rule such as M8 or P1, or you need its reason. |
| `spec.md` | Agent | You need the general view: the parts, who can do what, the rules on every path. |
| `deploy.md` | Agent | You write and publish a release, or point the writer at a remote database. |
| `authoring.md` | Agent | You write or change a document. |
| `agents/issue-tracker.md` | Agent | You write to GitHub. |
| `agents/commit.md` | Agent | You write a commit message. |
| `agents/coding-standards.md` | Agent | You review a diff against the standards of the code. |
| `agents/domain.md` | Agent | You need the domain words, or your change disagrees with a decision. |
| `agents/triage-labels.md` | Agent | You apply a triage label. |
