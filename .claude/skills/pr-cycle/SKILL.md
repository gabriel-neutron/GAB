---
name: pr-cycle
description: Take finished work from branch to merge in `staging` - push, pull request, review by a separate agent, fixes, merge. Use it when the code is done and tested, and the next step is the pull request.
---

# Pull request cycle

Do each step with no question. Stop only at a merge into `main` (ask first).

1. Confirm the identity: `gh api user --jq .login` must print `gabriel-neutron`.
2. Run the tests of the touched code. Fix a failure before you go on.
3. Commit (see `docs/agents/commit.md`), then `git push -u origin <branch>`.
4. Open the pull request into `staging` with `gh pr create`. Search the text for a local path,
   a user name and a token first (`docs/agents/issue-tracker.md`, section "Privacy").
5. Start the agent `pr-reviewer` on the pull request. When the diff changes the user interface
   (a component, a style, a route or a page), start the agent `visual-qa` at the same time.
6. Fix each finding, push, and run the review again only if a fix changed the logic.
7. Run `gh pr merge <number> --auto --merge`. If GitHub refuses, run
   `gh pr checks <number> --watch --fail-fast` in the background and merge when it exits 0.

The review agent is the check. Do not ask the operator to approve a merge into `staging`.
