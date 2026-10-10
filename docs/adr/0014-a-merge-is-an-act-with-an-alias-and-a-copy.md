# ADR 0014 — A merge is an act of the ledger, with an alias and a full copy

**Status** Accepted · 10 October 2026

## Context

`decisions.md` M12 asks for a merge that keeps the identifier and a full copy of the entity that
it absorbs, so that a wrong merge can be undone and an old identifier still resolves. The review
page will merge the vessels with one IMO number and the companies spelled in two scripts. A
release cites the identifiers, so the storage of a merge is costly to change after the first
release.

## Decision

### The merge and the undo are acts

- A merge is an act of the ledger. It targets the survivor and names the absorbed entity. An undo
  is an act too: it targets the absorbed entity and names the survivor. So the ledger is the log
  of each merge and each undo, with who decided it, the day and the origin (S4), and it stays
  append-only.
- The snapshot of the merge act is the full copy of what the merge changed: the absorbed row, each
  relation that named it, each value of the survivor that it changed (before and after), the act
  that set each value that it moved, and the aliases that it moved. There is no table of copies:
  the snapshot of an act already holds "what the act replaced".
- An alias table holds one row for each merge that stands: the absorbed identifier, the survivor
  of today and the merge act. It is a state, not a log. An undo deletes the row.

### Who merges

- Only the operator merges. Two doors, one for a merge and one for an undo, write the act and
  promote it in one transaction. Only the operator role holds them. A machine role has no grant,
  and the promotion refuses a merge that a rule, an AI reviewer or a decision on the queue would
  write. Identity is a judgement, and S3 gives the rules no such judgement.
- The writer gives the two doors to the screens of the operator. A merge names the survivor and the absorbed
  entity. An undo names the absorbed entity alone, and the record finds its merge.

### What a merge does

- The two entities have one type. The merge refuses two types, and an absorbed entity that an act
  that waits still names, because that act could never apply.
- Each relation of the absorbed entity moves to the survivor and keeps its identifier, its act and
  its label. A relation between the two entities, and a relation that the survivor holds already
  with the same type, the same other end and the same last day, would stand twice. It leaves the
  graph, and the copy keeps it.
- Each value that the survivor does not hold moves to it. A value that the survivor holds stays as
  the survivor holds it. When the two values are equal, the value keeps the documents of both.
- A moved value keeps the act that set it: the label of the views and the claims of a release read
  the act that the merge recorded for it. So a value that a rule accepted does not read as a value
  that the operator validated.
- An entity that the absorbed one absorbed before now resolves to the survivor. The alias always
  gives the survivor of today, with no walk of a chain.

### What an undo does

- Only the last merge of a survivor can be undone, because a later merge moved what the earlier
  one wrote.
- The absorbed row comes back from the copy, as it was. Each moved relation goes back, and each
  removed relation comes back while its two ends stand. Each value of the survivor goes back while
  it is still the value that the merge wrote.
- A later act stands. A relation that a later act deleted stays deleted, and a value that a later
  act changed stays changed.

### Resolve an old identifier

- A read view gives each absorbed identifier and its survivor of today, to the public read and to
  the tool roles. A survivor that the reader cannot read gives no row (PU1).
- A survivor with an alias cannot be deleted, so an old identifier always resolves.
- The release writes the log of the merges as one more file, in its manifest of files: each merge
  and each undo, with its label, and the entity that each absorbed identifier resolves to today. A
  merge or an undo that names a person is not in the release (PU1).
- The copy of a merge can hold a relation that names a person that the public read hides, so only
  a tool role reads the copy.

## Alternatives

- **A merge table with the copy and the log.** It is a second ledger beside the ledger, and the
  history of a row would then read two tables. Refused.
- **Keep the absorbed row and mark it.** Each read, each rule and each release would then filter
  the mark. One forgotten filter shows the entity twice. Refused.
- **Resolve an old identifier at each write.** A delete of an absorbed identifier would then
  delete the survivor. Refused: an act that names an absorbed entity is refused, as an act on a
  deleted entity is.

## Cost

- The operator decides each act that waits on the absorbed entity before the merge.
- A relation or a value that would stand twice leaves the graph. Its documents and its label stay
  in the copy only, and not in a release.
- The value that the survivor keeps wins over a different value of the absorbed entity, also when
  the absorbed value is newer.
- An undo after later acts on the survivor does not give back the record of the day before the
  merge: the later acts stand.
- A machine reads the alias view, but the tools do not yet resolve an absorbed identifier that a
  model names.
