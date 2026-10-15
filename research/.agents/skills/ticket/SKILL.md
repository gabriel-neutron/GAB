---
name: ticket
description: Run one research ticket from start to close in one session - read it, research it with subagents, propose, have a new reviewer subagent decide, get each missing tool built in a code session, and close the step. Use it when the operator gives a ticket number or types /ticket.
---

# Run a research ticket

The operator gives a ticket number. You run the loop below to the end. You do not give the
operator a prompt to paste, and you do not stop for a step that an agent can do.

## The loop

1. **Read.** Run `gh issue view <n> --comments`. Read the skill `research-method`. When the server
   instructions give the commit of the `gab` server, note it.
2. **Plan the lots.** Cut the step of the ticket into lots that do not depend on each other: one
   source, one list, one group of nodes. Use the skill `investigate-node` to find what the record
   holds and what is missing.
3. **Research.** Start one subagent for each lot, in parallel. Give each subagent the ticket
   number, its lot, and the skills `research-method`, `source-hunt` and `cite-claim`. Each
   subagent stores its sources and proposes its facts. It returns the proposal ids, the refusals
   and the URLs that need the browser. You drive the browser for these URLs (skill
   `source-hunt`).
4. **Correct.** A refusal names the field and the reason. Correct it and send the item again. An
   item that you send again and that waits in the queue is checked again.
5. **Review.** Start a new reviewer subagent. Give it only the ticket number and the proposal ids
   or the unit ids. It follows the skill `review-unit`. Never decide a unit yourself, and never
   give the reviewer your notes or your reasons.
6. **Close.** Use the skill `carto-step`, and post its text on the ticket with
   `gh issue comment <n> --body-file <file>`. Before the post, run `gh api user --jq .login`
   (it must print `gabriel-neutron`) and remove each local path, user name and token from the
   text.

## When a tool blocks the research

A tool that refuses a valid fact, or a type that the vocabulary does not hold, is a gap of the
software. A research session never edits code, so:

1. Send the gap to the skill `expert-panel` when it is a question of the data model.
2. Start a new code session yourself, where the build rules of the root `CLAUDE.md` put the
   code work, with a short brief: the gap, the refusal text, the ticket number and what done
   looks like. Continue the other lots.
3. When the code session says that its pull request is merged into `staging`, update the
   checkout: run `git -C .. pull --ff-only origin staging`, then `pnpm -C .. db:migrate` and
   `pnpm -C .. db:apply`. The `gab` server keeps its old code until it starts again, so when the
   pull changed `packages/`, ask the operator to reconnect `gab` with `/mcp`. Then check the
   commit that the server gives.
4. Send the blocked items again.

## Never

- Never give the operator a prompt to paste in a new session. Start the session yourself.
- Never decide a unit that this agent or its research subagents proposed.
- Never read `infra/.env` or another file with secrets. A tool that needs a value says which one.
- Never call `enqueue_extract`, `enqueue_mapping` or `start_lead` unless the ticket or the
  operator asks for it: they spend model credit.
