# ADR 0006 — A comment records a reason

**Status** Accepted · 19 August 2026

### 1. A comment records a reason, and never a reference

A **reason** says why the code is as it is. A **reference** says where a person argued it.

**A comment carries the reason. It carries no reference.**

| Do not write | Write |
|---|---|
| `Built from docs/detail-surface.md §4.1.` | `Four widths. The value chooses the width, and the pane chooses nothing.` |
| `ADR 0004 §7 puts the identity in the address.` | `The address holds the identity of what is examined. The same value in two stores is the defect.` |
| `A guess at #46.` | `A guess. No attribute arrives with its type yet, and the tracker carries that question.` |

Each right-hand cell says the same thing to a reader who has no document open. **That is the test
of a reason.**

### 2. A reference carries an address

**A path, a `§` and a `#` are each an address.** A comment that holds one names a place, and a
place is not a reason.

Three defects produced this rule, and each one is a fact of this repository.

- **A document is deleted, and the citation stays.** The four surface documents went on 17 August
  2026. Two days later, 67 paths under `src/` still named them and 578 section marks still pointed
  into their sections. Nothing failed and nothing warned.
- **A ticket closes, and the number stops saying anything.** A reader who meets `#46` must open a
  tracker to learn what the comment means. `authoring.md` already refuses this in a document: for
  an open question it writes "the tracker carries it", and it leaves the number out. A source file
  gets the same rule, and it gets no exception.
- **A section number binds the document it names.** A source file that cites `§4.1` makes every
  later editor of that document keep a `§4.1`. The code held the documentation still.

### 3. An identifier that `decisions.md` locks is a domain word, and it stays

`M4`, `M8`, `T5` and every other entry of the register stay in the code.

**An entry of `decisions.md` carries no address.** It has a name. It has no path, no section and no
line. The register is locked, so the name cannot be renumbered and cannot be deleted: a new
decision replaces an entry **by name**, and the name survives the replacement. The code already
speaks this way, because "an M4 relation" is a kind of relation and not a citation.

**One condition. The identifier never travels alone.** Write the rule, then name it. `M8: every
attribute carries at least one source` is a domain word. `See M8` is a reference, and it is
refused.

A commit hash and a tag stay for the same reason. A commit is frozen with the code it describes,
so it cannot drift.

### 4. A reference goes to the report, and then to the commit

**An agent puts the reference in its report.** ADR 0001 §5 keeps an agent out of the commit, so the
report is the only channel an agent has. The ticket a guess guesses at, the ticket an open question
waits on, the decision a rule comes from: each one goes under FILES or under ASK.

**The operator puts it in the commit message.** A commit is frozen with the code it describes, so a
reference there cannot drift: the ticket, the file and the reason stay one object for ever.
`git log` and `git blame` reach it from any line.

**This is why the eviction costs nothing.** The reference is not lost. It moves to the one place
that holds it and the code together.

### 5. The rule reaches authored source only

It reaches every file under `src/`: a comment, a file header, a doc comment, and a message that a
person reads on the screen.

It reaches nothing else. A document cites another document, and `authoring.md` says how. A skill
names the ticket an agent must fetch, because the agent needs the number to fetch it. A commit
message carries every reference it wants. A generated file carries what its generator writes.

### 6. A local lint rule refuses an address, and it cannot be suppressed

The rule lives in `eslint.config.ts`, scoped to `src/`, so it runs inside `pnpm check` at the lint
step. It needs no dependency and no new command. `noInlineConfig` is on, so no author can disable
it on a line, and a stale attempt to disable it is itself an error.

It refuses four shapes inside a comment: a ticket, a section mark, an `ADR nnnn`, and a path that
ends in `.md`.

**Both halves were measured before the rule was committed.** A comment carrying
`docs/map-surface.md §4.5, see #89 and ADR 0004` gives four errors, one for each shape, at the
column of each match. A comment carrying `#2971c6`, `#000000`, the register entries `M8`, `T5` and
`S2`, `invariant 1`, a commit hash and a tag gives none.

**A hexadecimal colour is not a ticket.** The pattern for a ticket needs a word boundary after one
to three digits, and no boundary follows three digits inside a six-digit hex. **This holds while a
ticket number stays under four digits**, and the rule says so above itself.

**A stylesheet is out of reach.** ESLint does not read `src/index.css`, so the references there
were removed by hand and nothing keeps them out.

## Consequences

- **A reader loses one hop to the argument.** The register in `docs/README.md` is the route to an
  ADR, and `docs/decisions.md` is the route to an entry. Each one is one document away.
- **One reader loses more than a hop, in one place.** A comment recorded that a ruling contradicts
  two documents and named which two. The fact survives and the names do not.
- **The section numbers of an ADR stay stable for the documents, and no longer for the code.**
  `authoring.md` cites them and the ADRs cite each other, so the obligation holds. Its ground
  changed.
- **A reason must now be written well, because nothing stands behind it.** A comment that said "see
  the ticket" and no more was thin before. It is empty now.
- **The rule costs a longer comment.** A citation is four words, and a rule is a sentence. The
  sentence is what the reader needed.
