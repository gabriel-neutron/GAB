# ADR 0025 — A start date is an act on the undated relation

**Status** Accepted · 14 October 2026

## Context

A relation of a dated type can come into the record with no start, because its first source
named the relation and gave no day. The sanctions layer holds such relations: a designation that
cites the entry of the list, with no dated notice of the authority. The start day counts for the
comparison of the regimes. The only way to give it was to delete the relation and create it
again with the day. That loses the documents of the old row and gives a new identifier, as ADR
0021 says for the end date. A second relation with the day is also wrong: the record then holds
two relations for one fact. The acts stay in the ledger for ever, so the shape of this act is
costly to change.

## Decision

- The act that changes a relation has a fourth form: the start date alone. It targets the
  relation and holds no other value. An act that gives a start and an end, or a start and an
  attribute, is refused.
- The promotion writes the start and adds the documents of the act to the documents of the row,
  as for the end date (ADR 0021). The copy of the act holds what it replaced: no start, and the
  documents of the row before the act.
- The database refuses the start on a type that takes no interval, on a relation that has a start
  already, and after the last day of the relation. The batch door of a machine reads the same
  rules, and the promotion reads them again under the lock of the row.
- A start date is never changed. A wrong start is a judgement of the operator: delete the relation
  and create it again.
- A machine can send this form. The start is the whole act, so an excerpt must state it: the
  research AI gets a refusal, and a back-end agent gets its item disputed.
- The review check blocks a start on a relation that has one, and marks two start dates that wait
  on one relation as a conflict. The review card reads "Start of a relation" and gives the last
  day of the relation in the record.
- The public read, the release and the undo of a merge treat the start as they treat the end:
  PU1 on the copy, a claim of its own with the label of the act, and a later start is kept.

## Alternatives

- **Reject the relation and propose it again with the day.** It loses the documents and the
  identifier of the promoted row. Refused, as in ADR 0021.
- **A second relation with the day.** Two relations for one designation. Refused.

## Cost

- One more form in each read of the act that changes a relation, in the database and in the front.
- A reader of the read API finds the label of a later start date in the ledger, and not on the row.
