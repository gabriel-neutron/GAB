# ADR 0021 — An end date is an act on the open relation

**Status** Accepted · 10 October 2026

## Context

A change of flag, owner, operator or insurer ends a relation of a dated type (`decisions.md` M6).
The relation is often in the record with no end, because the first source gave only its start.
Before this decision, the only way to give it an end was to delete it and create it again with
both bounds. The delete lost the documents of the old row, and the new row had a new identifier,
so a release that cited the old one broke. The acts stay in the ledger for ever, so the shape of
this act is costly to change.

## Decision

- The act that changes a relation has a second form: the end date alone. It targets the relation,
  and it holds no other value. An act that gives an end and changes an attribute is refused.
- The promotion writes the end and adds the documents of the act to the documents of the row. The
  documents of the row back its dates, so no document of the old row is lost. The copy of the act
  holds what it replaced: no end, and the documents of the row before the act.
- The database refuses the end on a type that takes no interval, on a relation that has an end
  already, and before the first day of the relation. The batch door of a machine reads the same
  rules, so an act that can never apply does not wait in the queue. The promotion reads them
  again, because another act can close the relation in between.
- An end date is never changed. A wrong end is a judgement of the operator: delete the relation
  and create it again.
- A machine can send this form, and no other change of a relation. The end must be in a cited
  excerpt, as each bound of a new relation. The research AI gets a refusal when no excerpt states
  it. A back-end agent gets its item disputed, so the operator reads the page.
- The public read applies PU1 (`decisions.md`) to the copy of the act: on a relation that names a
  person, the copy is public only when the old row cites a public document, and it names only the
  public documents.
- The end date carries the label of the act that gave it (PU1). A release writes it as a claim of
  its own, a value of the relation, with the label, the documents and the passages of that act.
  The row of the relation keeps the label of the act that made it, also for the first day. The
  read API gives the act of the end date in the ledger.
- The review check blocks an end date on a relation that ended already or that the record no
  longer holds, and it marks two end dates that wait on one relation as a conflict.
- The undo of a merge keeps a later end date (ADR 0014).

## Alternatives

- **A new operation "close relation".** One more name in each list of operations, in each read
  and in each check, for an act that changes a relation. Refused.
- **Delete and create again.** It loses the documents and the identifier of the old row. Refused.
- **Let the end date change.** A second end on one relation is a dispute between sources, and the
  operator decides it. Refused.

## Cost

- A reader of the read API finds the label of an end date in the ledger, and not on the row of
  the relation.
- The extractor reads no relation of the record, so it does not propose an end date today. The
  research AI does it, from the relations that `read_entity` gives.
