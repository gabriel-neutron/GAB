# Writing a commit message

ADR 0006 §4 sends every reference out of the source and into the commit message. This document
says what that message holds. A commit is frozen with the code it describes, so it cannot drift:
the ticket, the file and the reason stay one object for ever, and `git log` and `git blame` reach
them from any line.

## Who commits

ADR 0001 §5 owns the definition of done. An agent commits its own work when `pnpm check` passes
and the change matches its ticket, **and when a second agent read the diff and reported no
finding**. The writer is the weakest reader of its own diff: it knows what it meant to write, so
it reads the intention and not the text. `pnpm check` measures conformance and never correctness,
so a passing check is a floor and never the gate.

A test the ticket asked for is one form the second reading takes, and never a substitute for it.
A green test proves the case it names, and a review reaches the case nobody named.

**The orchestrating session commits, and a subagent does not.** It is the only actor that sees
both the diff and the finding, so it is the only one that can measure the gate above.

**One exception: the `resolve-ticket` workflow.** Its implementer and its fixer commit on their
own `fix/<n>-<slug>` branch, and only there. The gatekeeper of the workflow is the second reader:
it re-runs the tests and `pnpm check`, reads the review panel, and approves or sends change
requests. Nothing reaches `staging` before it approves, and nothing reaches `main` before the
operator promotes `staging`. The branch is the reason the exception is safe: a commit there
changes nothing that another reader depends on.

No hook and no continuous-integration step holds any rule in this document. The rule is the
document, and a reader holds it.

## The header

`type(scope): a lower case sentence`

Conventional Commits, with no full stop at the end. The sentence states what the commit made
true, and not what work was done: *one file holds the standard, and eight targets read it*, and
not *refactored the tsconfig files*.

## The body

Simplified Technical English, as `CLAUDE.md` requires of every message. **Each claim is in bold.**

Write the defect or the reason first, then what changed, then the cost. A reader who meets the
commit in `git blame` needs to know why the line exists before they need to know what it does.

**Record the check that was run** when a change was proved against the live stack, a browser or a
measurement. Name the command and its result. A measurement keeps the date it was taken.

## The trailer

Three verbs, and each one has one meaning:

| Verb | Meaning |
|---|---|
| `Closes #n` | The commit answers the ticket, and the ticket closes with it. |
| `Refs #n` | The commit touches the ticket, and the ticket stays open. |
| `Part of #n` | The commit does one step of the ticket, and the ticket stays open. |

The trailer names every ticket the work touches. **No trailer is correct when the work touches
none.** A refactor with no ticket behind it is real work, and an empty trailer is honest; opening
a ticket to satisfy a form is paperwork.

`Closes` and `Part of` are not interchangeable. Only `Closes` makes GitHub act.

A `Co-Authored-By` trailer names each agent that wrote part of the change.

## What the message may carry that the code may not

Every reference. ADR 0006 §5 states it: a comment under `src/`, under `packages/*/src` or under
`.storybook` records a reason and never a pointer, and a commit message carries every reference it
wants — a ticket, a document, a section, a commit hash or a tag. This is why the eviction from the
source costs nothing.
