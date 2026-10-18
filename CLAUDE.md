Write every document, code comment, commit, pull request, issue and GitHub comment in ASD-STE100 Simplified Technical English. Keep replies to the operator short.
The repository is public: never write a local path, a user name or private data in GitHub, a commit or a file (docs/agents/issue-tracker.md, section "Privacy").
Docs map: docs/README.md. Read docs/authoring.md before you write a document. The code is the source of truth: a document never copies a name, a count or a command output.
Develop on the VPS (infra/vps/README.md). In a worktree, run `pnpm stack:up` before a database test and `pnpm stack:down` at the end, also in a subagent (infra/README.md).
Use the Matt Pocock skills (`/to-spec`, `/to-tickets`, `/implement-spec`). Fix a small detail in the current work with no ticket.
Decide each technical detail yourself. Send each other question to the skill `expert-panel` and act on its verdict. Only a critical question goes to the operator.
Do each step that git can undo without asking: fix, test, commit, push, open the PR, review it with a separate agent (add `visual-qa` when the diff changes the user interface), apply the findings, merge into `staging`.
Ask before a merge into `main`, a loss that git cannot undo, a GitHub write outside the task, or a cost.
End each message with one line: **Done.**, **Next:** a step for the operator or a new session, **New session:** the prompt, or **Your decision:** one critical question with the panel verdict and a recommendation. Offer no optional extra work.
