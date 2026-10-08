Write your chat replies to the operator in French. Write every repository document, code comment, commit, pull request, issue and GitHub comment in ASD-STE100 Simplified Technical English (exception: the research deliverables, see `research/AGENTS.md`).
Do the development on the VPS. The VPS runs the code and the test stack. The research sessions, the record, the writer and the worker are on the operator's Windows PC (`infra/vps/README.md`).
In a worktree, run `pnpm stack:up` before a database test and `pnpm stack:down` at the end of the work, also in a subagent (`infra/README.md`).
The repository is public: never write a local path, a user name or private data in GitHub, a commit or a file (section "Privacy" of docs/agents/issue-tracker.md).
Work with the Matt Pocock skills (`/to-spec`, `/to-tickets`, `/implement-spec`). Fix a small detail in the current work, with no ticket.
Decide each technical detail yourself. Ask the operator only a product question. Read docs/authoring.md before you write a document.
Do each step of the request that git can undo, and do not ask first: fix, test, commit, push, open the PR, review it with a separate agent (add a `visual-qa` agent when the diff changes the user interface: a component, a style, a route or a page), apply the findings, merge into `staging`. Ask before a merge into `main`, a loss that git cannot undo, a GitHub write outside the task, or a cost.
End each message with one line: **Done.**, **Next:** the step or the command, **New session:** the prompt, or **Your decision:** one product question with a recommendation. Offer no optional extra work.

## Agent skills

Issue tracker: docs/agents/issue-tracker.md. Triage labels: docs/agents/triage-labels.md. Domain docs (single-context): docs/agents/domain.md.
