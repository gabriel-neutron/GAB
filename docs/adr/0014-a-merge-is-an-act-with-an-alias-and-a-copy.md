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
  targets the absorbed entity and names the survivor. So the ledger is the log of each merge and
  each undo, with who decided it, the day and the origin (S4).
- The snapshot of the merge act is the full copy of what the merge changed: the absorbed row and
  its place on the graph, each relation that named it, the relations and the values of the
  survivor that it changed (before and after), the act of each value that it moved, and the
  aliases that it moved. The snapshot of an act already holds "what the act replaced", so no table
  of copies exists.
- An alias table holds one row for each merge that stands: the absorbed identifier, the survivor
  of today, the merge act and its hour. It is a state, not a log. An undo deletes the row.

### Who merges

- Only the operator merges, through two doors that write the act and promote it in one
  transaction. A machine role holds neither door, and the promotion refuses a merge from a rule,
  an AI reviewer or a decision on the queue. Identity is a judgement, and S3 gives the rules none.
- A merge can keep the name of the absorbed entity as a former name of the survivor. The merge is
  then the act of that value, and the undo takes the name away.
- A machine act that names an absorbed entity is refused, with the survivor in the refusal.

### What a merge does

- The two entities have one type. The merge refuses an act that waits and names the absorbed
  entity, or a relation that the merge removes, because that act could never apply.
- Each relation of the absorbed entity moves to the survivor and keeps its identifier, its act and
  its label. A relation between the two entities leaves the graph. A relation that the survivor
  holds already, with the same type, the same other end and the same last day, leaves the graph
  too, and its twin takes its documents and the earlier first day.
- Each value that the survivor does not hold moves to it. A value that the survivor holds stays.
  Two equal values keep the documents of both.
- A moved value keeps the act that set it, so the label and the claims of a release stay true: a
  value that a rule accepted does not read as a value that the operator validated.
- An alias of the absorbed entity moves to the survivor, so an alias always gives the survivor of
  today.

### What an undo does

- Only the last merge into a survivor, and only while the survivor stands, can be undone: a later
  merge wrote over what the earlier one wrote.
- The absorbed row and its place come back as they were. Each moved relation goes back, and each
  removed relation comes back while its two ends stand. Each relation and each value of the
  survivor goes back while it is still what the merge wrote. A later act stands.

### Resolve an old identifier

- A read view gives each absorbed identifier and its survivor of today, to the public read and to
  the tool roles. A survivor that the reader cannot read gives no row (PU1).
- A survivor with an alias cannot be deleted, so an old identifier always resolves.
- The release writes the log of the merges as one more file of its manifest: each merge and each
  undo, its label, and the survivor that each absorbed identifier resolves to. A row names only
  entities of the release, and never a person (PU1).
- Only a tool role reads the copy, because it can hold a relation that names a hidden person.

## Alternatives

- **A merge table with the copy and the log.** A second ledger, and the history of a row would
  read two tables. Refused.
- **Keep the absorbed row and mark it.** Each read, rule and release would filter the mark, and one
  forgotten filter shows the entity twice. Refused.
- **Resolve an old identifier at each write.** A delete of an absorbed identifier would delete the
  survivor. Refused.

## Cost

- The operator decides each act that waits on the absorbed entity before the merge.
- A relation that leaves the graph keeps its own act and label in the copy only.
- The value of the survivor wins over a different, newer value of the absorbed entity.
- The merges into one survivor are undone in the reverse order.
- An undo can be refused by the rule of one open relation of a type between two ends, when a
  later act opened such a relation on a restored end. The operator closes it, and undoes again.
- The search tools do not yet resolve an absorbed identifier that a model names. The propose door
  refuses it.
