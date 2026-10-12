# ADR 0023 — A type change is an act on the promoted relation

**Status** Accepted · 12 October 2026

## Context

The record holds promoted relations of type `designated_by` that state a sectoral measure and not
a listing with an asset freeze: OFAC directives, and the sectoral annexes and articles of
Regulation (EU) 833/2014 other than Annex XLII. These relations must be `restricted_by`. The
record had no act that changes the type of a relation. The only way was to delete the relation
and create it again. That loses the documents of the old row, gives the row a new identifier, and
breaks a release that cites the old identifier. ADR 0021 refused this way for the end date, and
the same reasons hold here. The acts stay in the ledger for ever, so the shape of this act is
costly to change.

## Decision

- The act that changes a relation has a third form: the type alone. It targets the relation and
  it holds the new type, and no other value. An act that gives a type and an end date, or a type
  and an attribute, is refused. The shape check names one pair only: the new type is
  `restricted_by`, and the old type is `designated_by`. A free change of type is a judgement of
  the operator and needs its own decision.
- The promotion writes the type and adds the documents of the act to the documents of the row.
  The identifier and the dates do not change. The copy of the act holds what it replaced: the old
  type, and the documents of the row before the act.
- The database refuses the form on a missing relation, on a relation that is not `designated_by`,
  and on an open `restricted_by` relation between the same two ends. The batch door of a machine
  reads the same rules, so an act that can never apply does not wait in the queue. The promotion
  reads them again under the lock of the row, because another act can change the row in between.
- A machine can send this form. The excerpt must name the provision: a directive, an annex or an
  article, by its number. The research AI gets a refusal when no excerpt names it. A back-end
  agent gets its item disputed, so the operator reads the page.
- The public read applies PU1 (`decisions.md`) to the copy of the act, as for the end date.
- The undo of a merge keeps a later type change and the documents that it added (ADR 0014).

## Alternatives

- **A new operation "retype relation".** One more name in each list of operations, in each read
  and in each check, for an act that changes a relation. Refused, as in ADR 0021.
- **Delete and create again.** It loses the documents and the identifier of the old row. Refused.
- **A free change of type.** Any pair of types, with no rule on the old type. The act becomes a
  free edit of the type, and the operator no longer decides each pair. Refused.

## Cost

- The pair is fixed in the shape check of the table. A second pair needs a new migration.
- The check of the provision in the excerpt reads a number after the word directive, annex or
  article. A passage that names a provision in other words is not accepted for a machine.
