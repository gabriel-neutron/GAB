# db

The schema. The `.sql` files are the only source of truth for it.

[ADR 0003](../docs/adr/0003-schema-pipeline-and-read-contract.md) governs this folder: the two
kinds of file, the order they run in, the schemas, the roles and the generator. Read it before you
write SQL. `docs/spec.md` gives the rules that the SQL must enforce.

- **No document draws this schema.** Read the SQL for the authority on a constraint.
- **One shape, one table.** When a thing can be a column, an index or a view on a table that
  exists, it does not get its own table.
- **A migration is never first applied to data that matters.** ADR 0003 gives the steps.
