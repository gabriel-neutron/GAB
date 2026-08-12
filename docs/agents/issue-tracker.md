# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Identity — read this before any write

This machine has two GitHub accounts. Every write to this repository must act as
**`gabriel-neutron`**, never as `Rovis91`. The repository is public, and a comment or a
commit made under the wrong account cannot be retracted from a public history or from
anyone's notification mail.

A `GH_TOKEN` in `.claude/settings.local.json` (gitignored) pins the identity. It overrides
`gh`'s stored login unconditionally. Confirm it before any write:

```bash
gh api user --jq .login    # must print: gabriel-neutron
```

The token is a fine-grained PAT. If a `gh` call fails, read **Fault-finding** at the end of
this document. Do not run `gh auth login` or `gh auth switch`.

## Pull requests as a triage surface

**PRs as a request surface: no.** External PRs are not treated as feature requests. Set
this to `yes`, and add the `gh pr` commands, only if that changes.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Read `wayfinder-tracker.md`, beside this file, when a wayfinder skill is installed and it
names a map, a child ticket, a blocker or the frontier. No such skill is installed today.

## Fault-finding

Read this only when a `gh` call fails.

**Symptom.** Every `gh` call and every `git push` returns `401 Bad credentials`, while
`gh auth status` still reports a valid stored login. The symptom is misleading: "I am
logged in, but every call fails."

**Cause.** The fine-grained PAT expired. It expires about 4 November 2026.

**Repair.** Mint a new fine-grained PAT for `gabriel-neutron/GAB`, with Contents and Issues
read-write. Replace the value in `.claude/settings.local.json`. **Do not run `gh auth
login` or `gh auth switch`** — those commands restore the machine-wide account, which is
`Rovis91`.
