# db

The schema. [ADR 0003](../docs/adr/0003-schema-pipeline-and-read-contract.md) governs this
folder. Read it before you write one line of SQL.

**These files are the only source of truth for the schema.** No TypeScript type describing the
database is written by hand. Every one is generated from the live database.

A drift check must fail the build when a generated file differs from what is committed. **The
generator is Kanel**, named and measured in ADR 0003 §8. The check needs a table to read, so it
arrives with the first migration, and `pnpm check` then runs every step of ADR 0001 §3.

## The two kinds of file, and the rule that separates them

| Kind | Folder | Runs |
|---|---|---|
| Tables, columns, indexes, roles, extensions | `migrations/` | Once, in order, each in a transaction |
| Views, functions, triggers, grants | `apply/` | Every run, each file holding its whole current definition |

**Two copies of a `CREATE TABLE` always drift apart**, so a table is never re-runnable. A
function holds no state, so it is never versioned as a sequence of edits.

`apply/` runs in a fixed order: the `api` schema, then views, then functions, then triggers,
then grants.

## Reaching the current state, from zero

```
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate
pnpm db:apply
```

There is no baseline dump, and there is no step applied by hand. A new machine runs those
three lines.

## Testing a migration

`pnpm db:reset` destroys the volume. The three commands above run against an empty database.
The tests then run against it. **A migration is never first applied to data that matters.**

## Two schemas, and the line between them

| Schema | Holds | `gabriel_read` gets |
|---|---|---|
| `public` | The base tables | Nothing. Not even `USAGE`. |
| `api` | Views and functions built for reading | `USAGE` on the schema, `SELECT` on the views, `EXECUTE` on the functions |

A view can change while its output stays the same. A base table cannot. One view per concept,
not per surface.

## Four roles — ADR 0003 §7 holds them

| Role | Writes |
|---|---|
| `gabriel_owner` | Nothing, by connecting. It **owns** the tables and the write functions, and it never logs in. |
| `gabriel_app` | No table directly. It calls the write functions, and nothing else. |
| `gabriel_agent` | The candidate layer only — proposals, chunks and embeddings. |
| `gabriel_read` | Nothing. `USAGE`, `SELECT` and `EXECUTE` inside `api` only. |

**A prompt is not a permission**, and a grant is what holds a write. Invariant 5 is settled on
a privilege boundary: no role writes `entities` or `relations`, and a `SECURITY DEFINER`
function owned by `gabriel_owner` is the only door. **`gabriel_app` writes no proposal
either** — one role that can write a proposal and also promote it makes a promotion that no
constraint can tell from a true one, and that was measured.

Read ADR 0003 §7 before you write a role, a grant or a `SECURITY DEFINER` function. It carries
four rules that each cost a measured failure, above all `SET search_path` on every such
function and `SET LOCAL ROLE gabriel_owner` at the head of every ordered file.

## Nothing is here yet, and that is on purpose

No migration file exists. **No table, column, constraint or trigger is decided.** ADR 0003
settles how the schema is applied, not what it contains. `docs/schema.md` stays provisional
and is an illustration, never an authority. The real schema is written when the build needs
it, and it must satisfy `docs/spec.md` §2.

The `db:migrate`, `db:apply` and `db:reset` commands are named by ADR 0003, and they enter
`package.json` with the first migration, because a command that runs no file reports success
and does nothing.
