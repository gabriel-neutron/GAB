# Documentation index

Keep each document in `docs/`. Two files stay at the repository root, because the tools
read them from that path: `README.md` (the public front page) and `CLAUDE.md` (the agent
rules).

## Read this first

For a normal coding task, read `spec.md` only. Go to another document when the table below
sends you there. Do not read the whole folder.

| Document | Lines | Read it when |
|---|---|---|
| `spec.md` | 161 | Always. It holds the invariants, the read path and the write path. |
| `schema.md` | 485 | You touch a table, a column, a constraint, a trigger or an index. |
| `decisions.md` | 314 | `spec.md` cites an identifier such as `(M8)` or `(T5)` and you need the reason or the cost. Start at the index table at the top. |
| `prd.md` | 145 | You need the scope: what Gabriel does, and what it refuses to do. |
| `agents/issue-tracker.md` | 71 | You write to GitHub: an issue, a comment, a label. |
| `agents/domain.md` | 57 | You explore the code and you need the domain words. |
| `agents/triage-labels.md` | 6 | You apply a triage label. |
| `adr/` | — | Architecture decision records. They need no entry in this index. |

## Rules

- A new document in `docs/` must have a line in the table above before you make it.
- Keep this index under 200 lines. It is an index, not a document.
- A document longer than 250 lines must have a table of contents.
- Only the operator changes a document in `docs/`. An agent asks first.
