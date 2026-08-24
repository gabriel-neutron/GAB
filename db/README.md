# db

The schema.

**[ADR 0003](../docs/adr/0003-schema-pipeline-and-read-contract.md) governs this folder, and it
holds every rule that follows from it**: SQL as the only source of truth, the two kinds of file
and the order they run in, the commands that reach the current state from zero, the two schemas,
the four roles, and the generator. **Read it before you write one line of SQL.**

**This file repeats none of it.** Two copies of one rule drift apart, which is the defect ADR
0003 §1 exists to end, and a copy inside the folder that ADR governs is the worst place to keep
one.

## The three rules that live here

**No document draws this schema, and this one draws none.** `docs/spec.md` §2 holds the rules
the SQL must satisfy, and the `.sql` files hold the shape. Read the SQL for the authority on a
constraint, and never a document.

**One shape, one table.** A table that mirrors what another table already holds drifts from it.
When a thing can be a column, an index or a view on a table that exists, it does not earn a
table of its own.

**A migration is never first applied to data that matters.** ADR 0003 §5 gives the steps.
