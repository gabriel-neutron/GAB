# Writing a commit message

## The header

`type(scope): a lower case sentence`

Use Conventional Commits, with no full stop. The sentence states what the commit made true, not the
work that was done.

## The body

Write 1 to 3 short lines in Simplified Technical English: the reason, then what changed. A commit
can hold references (a ticket, a document, a commit hash). The code holds none (ADR 0006).

## The trailer

- `Closes #n`: the commit answers the ticket, and the ticket closes.
- `Refs #n`: the commit touches the ticket, and the ticket stays open.
- A `Co-Authored-By` line names each agent that wrote part of the change.

No trailer is correct when the work touches no ticket.

## Privacy

The repository is public, and a commit stays in the history. Read `issue-tracker.md`, section
"Privacy", before the first commit.
