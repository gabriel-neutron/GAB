# ADR 0006 — A comment records a reason

**Status** Accepted · 19 August 2026

## Decision

A **reason** tells why the code is as it is. A **reference** tells where a person argued it.

**A code comment records a reason. It never records a reference.** A path, a section mark and a
ticket number are each a reference.

| Do not write | Write |
|---|---|
| `Built from the detail surface document, section 4.1.` | `Four widths. The value chooses the width, and the pane chooses nothing.` |
| `A guess at ticket 46.` | `A guess. No attribute arrives with its type yet, and the tracker carries that question.` |

The test of a reason: a reader who has no document open understands it.

## Reason

A reference is an address, and an address is not a reason. Three defects in this repository
caused this rule:

- **A document is deleted, and the citation stays.** Nothing fails and nothing warns.
- **A ticket closes, and its number stops telling anything.** The reader must open the tracker to
  learn what the comment means.
- **A section number binds the document that it names.** Each later editor of that document must
  keep the number, so the code holds the documentation still.

## What stays in a comment

- **A name that `decisions.md` locks** (for example M8) is a domain word, not an address. The
  register never renumbers or deletes a name. Write the rule, then name it: "M8: every attribute
  carries at least one source". "See M8" alone is a reference, and the reviewer refuses it.
- **A number that is given once and never given again**, such as a numbered invariant of
  `spec.md`, is a name too. A number that a list can renumber is an address.
- **A commit hash and a tag** stay, because they are frozen with the code.

## Where a reference goes

A reference goes in the commit message and in the report of the agent. A commit is frozen with the
code that it describes, so a reference there cannot become wrong. `git log` and `git blame` find it
from each line.

## Scope and enforcement

The rule applies to authored source: the code under `src/`, the source of each package and the
Storybook configuration. It applies to a comment, a doc comment and a message that a person reads
on the screen.

It does not apply to documents, skills, commit messages or generated files.

**The SQL under `db/` is an exception, by operator decision.** There, a comment can record where
the SQL departs from an accepted decision and name the place where the correction is argued. If
the address goes, the next reader can restore the rule and break the read. The cost is the defect
above: a reference in SQL can become wrong, and nothing warns.

A local lint rule refuses each shape of reference that it can identify. Inline configuration is
off, so an author cannot disable the rule on a line. A hexadecimal colour is not a ticket number,
and the rule lets it pass. The rule cannot read a stylesheet, so a reviewer keeps references out of
the stylesheet.

## Consequences

- A reader is one step farther from the argument. The register in `docs/README.md` and
  `decisions.md` give that step.
- A reason must be written well, because no citation stands behind it.
- A comment becomes longer. A citation is four words, and a rule is a sentence. The reader needs
  the sentence.
