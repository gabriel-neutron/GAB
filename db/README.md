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

## What is here

The first schema. Six tables, and the operator settled the shape on 20 August 2026 after the
model-shape debate on #97 cut it from thirteen.

| Table | Holds |
|---|---|
| `documents` | One row per source. The raw file stays in the object store; this is the reference. |
| `entity_type` | The closed list of entity types, with the two hues a canvas needs. |
| `attribute_key` | The closed list of attribute keys, with the kind, the unit and the format of each. |
| `proposals` | The candidate layer **and** the record of every change. The status tells the two apart. |
| `entities` | M2, with the value in the row: `{"key": {"v": …, "src": [...]}}`. |
| `relations` | M2 and M4, the same attribute shape, with the two ends and the M6 interval. |

**No document draws this schema.** `docs/schema.md` was deleted on 20 August 2026, because two
drawings of one `CREATE TABLE` always drift apart. `docs/spec.md` §2 holds the rules that the
SQL must satisfy, and the SQL holds the shape.

**Two tables of the debate are absent on purpose**, and each one was folded into something
smaller: the provenance mirror is now the view `api.value_support`, and the touched-elements
table is now the `proposals.names` column with a GIN index. **One shape, one table.**

## What is not here yet, and who owns it

The agent and workflow chain — five tables — is deferred by the operator. **It must land in the
same change as the first agent, and never after it**: a rendered prompt cannot be re-derived,
so a trail that was not captured cannot be backfilled (#16). `proposals` therefore carries no
`call_id` today.

`doc_chunks` and a job queue (T5), the map layers (#36), and the merge alias and snapshot of
M12 all wait for the first migration that needs them.

The `db:migrate`, `db:apply` and `db:reset` commands are named by ADR 0003, and they enter
`package.json` with the migration tool, because a command that runs no file reports success
and does nothing.
