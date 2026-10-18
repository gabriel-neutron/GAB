# ADR 0027 — A source is an act on the promoted relation

**Status** Accepted · 18 October 2026

## Context

The alignment matrix (ADR 0017) gives a designation to a regime only when the relation cites a
document of an official file. A designation can be dated and accepted, and cite only the Federal
Register or a gov.uk notice. It then counts in no regime. A twin relation that cites the official
line would double each vessel on the site and in the CSV files, and it would inflate the counts.
The act that changes a relation could not add a source (ADRs 0021, 0023 and 0025).

## Decision

- The act that changes a relation has a fifth form: `add_source`, with the payload
  `{"add_source": true}` and no other value. The documents that the act cites join the documents
  of the relation. The dates and the type do not change.
- The database refuses the act on a relation that cites each of these documents already. The
  batch door reads the rule, and the promotion reads it again under the lock of the row.
- The copy of the act holds what it replaced: the documents of the row before the act.
- The propose tool takes `{"op": "add_source", "targetId": ...}`. The excerpt must be in the stored
  text, and the checker reads it. The tool refuses an excerpt that names neither the IMO number of
  the vessel nor the act of the relation.
- `ofac_sdn` and `uk_sanctions_list` give the page of the entry. A long file has more than one
  page, and a later page has no header, so the columns of page 1 read it.

## Alternatives

- **A twin relation that cites the official line.** Doubles the vessel. Refused.
- **Reject and create the relation again.** Loses the documents and the identifier (ADR 0021).

## Cost

- One more form in each read of the act that changes a relation, in the database and in the front.
- The tool reads the entry on the first page that holds a line of it.
