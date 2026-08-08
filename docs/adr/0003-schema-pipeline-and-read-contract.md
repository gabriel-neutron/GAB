# ADR 0003 — Schema pipeline and the read contract

**Status** Accepted · **Version** 1 · 7 August 2026
**Tickets** #22 (closed by this ADR), #23 (closed by this ADR), #26 type generation, #6 read
layer, #24 test runner, #15 invariant 5
**Resolves** the `db/` row of the "Deliberately absent" table in ADR 0001. `db/` is now
created. **`src/contract/` stays absent** until #26 names a generator, because its content is
generated and nothing generates it yet. The rest of ADR 0001 stays true and stays Accepted.

## Context

`spec.md` §6 held two open questions. #22 asked which tool applies the DDL, and in what
order. #23 asked what the read-only role selects from. Both gate real work: #22 gates the
first line of SQL, and #23 gates the contract the UI is written against.

Three constraints already decided make this one decision, not two:

- **T6** puts a `CHECK` constraint in the database. **`spec.md` §4** puts the graph traversal
  in a SQL function. M4 and S2 need triggers, and `spec.md` §5 makes a promotion one
  transaction. #22 records that all of these are SQL. Half of the system's rules are
  therefore SQL, and SQL is logic that needs versions.
- **T4** makes the frontend read the database on its own. Whatever the read role exposes
  becomes the contract the UI is written against.
- The operator builds in the order usecase → UI → data, so the UI meets that contract before
  the database exists.

The operator added one requirement when these two questions were settled: **the schema must
have one source of truth, and the code must be technically unable to drift from it.**

## Decision

### 1. SQL is the only source of truth

The `.sql` files are the schema. Nothing else is.

TypeScript types are **generated** from the live database by introspection. No column name is
written twice, and no type is written by hand. A drift check regenerates the types and fails
if the result differs from what is committed. Drift is a failing build, not a discipline.

That check belongs in `pnpm check`. ADR 0001 §3 defines that command as three steps, and it
is not amended here, because no generator exists yet and the step would need a running
database. **#26 adds the step, and closing #26 amends ADR 0001 §3.**

A TypeScript-first tool that writes the SQL — Drizzle Kit and its family — is **rejected**.
PostGIS geometry and the `vector` type do not exist in a TypeScript schema language, and
neither do triggers or the traversal function. The generator would be fought on every object
that matters, and the SQL would still be hand-written, but inside escape hatches.

### 2. `node-pg-migrate` applies the ordered files

It is an npm dependency, so ADR 0001 keeps one package and pnpm, and no second binary is
installed on the machine. It runs plain SQL files. That is the whole requirement.

### 3. Ordered files, and re-runnable files

| Kind | Where | Runs |
|---|---|---|
| Tables, columns, indexes, roles, extensions | `db/migrations/` | Once, in order, each in a transaction |
| Views, functions, triggers, grants | `db/apply/` | Every run, in a fixed order, each file holding its whole current definition |

Two copies of a `CREATE TABLE` always drift apart, so a table is never re-runnable. A
function has no state, so it is never versioned as a sequence of edits.

`db/apply/` runs in this order: the `api` schema, then views, then functions, then triggers,
then grants.

### 4. Three commands reach the current state, from zero

**These commands are defined here and are not yet in `package.json`.** They are added with the
first migration, because a command that runs no file reports success and does nothing.

```
docker compose -f infra/docker-compose.yml up -d    the database exists and is empty
pnpm db:migrate                                     ordered files, 0001 upward
pnpm db:apply                                       re-runnable files, every one
```

A new machine runs those three lines. There is no baseline dump, and there is no step applied
by hand. At the target volumes — 1 to 10k entities, 100 to 1k documents — a full replay costs
seconds.

`pnpm db:reset` destroys the volume and runs the three lines again.

### 5. A migration is tested against an empty database, never against real data

`pnpm db:reset`, then the three commands, then the tests. A migration is never first applied
to data that matters.

### 6. Two schemas. The read role never touches a base table

| Schema | Holds | `gabriel_read` gets |
|---|---|---|
| `public` | The base tables | Nothing. Not even `USAGE`. |
| `api` | Views and functions built for reading | `USAGE` on the schema, `SELECT` on the views, `EXECUTE` on the functions |

`db/apply/40_grants.sql` revokes everything on `public` from `gabriel_read`, then grants
inside `api` only.

**One view per concept, not per surface.** A surface-shaped view multiplies with the user
interface. A concept-shaped view does not. Graph traversal stays a function, per T4.

The operator owns the views and the functions. They are re-runnable files in `db/apply/`, so
§3 applies them on every run. No view is created outside that folder.

A view can change while its output stays the same. A base table cannot. Grant on base tables,
and the shape of a table becomes the shape of the user interface. Then #15 adds a column for
the origin of a row. PU1 requires that origin on every claim that is shown. The change then
reaches every component that reads that table.

No read passes through the Node backend. A view lives inside the database, so it adds no hop
and no service. T4 is unaffected.

### 7. Three roles, so an agent is held by a grant and not by a prompt

| Role | Writes |
|---|---|
| `gabriel_app` | Everything the backend needs, promotion included |
| `gabriel_agent` | `proposals` and `doc_chunks` **only**. Never `entities`, never `relations`. |
| `gabriel_read` | Nothing. `SELECT` and `EXECUTE` inside `api` only. |

An agent holds no database password. The backend exposes tools — search, read, propose — and
each tool runs under `gabriel_agent`. A prompt is not a permission.

**This constrains the agent. It does not enforce invariant 5.** `gabriel_app` still writes
`entities` and `relations`, so a fault in the backend can still put a row there without a
promotion. The enforcement tier for invariant 5 stays **open — #15**, and `spec.md` §2 still
records it as undecided. This ADR narrows the hole. It does not close it.

### 8. `src/contract/` holds generated types, not written ones

`src/contract/api.ts` is generated from the `api` schema. The user interface imports it. The
mock returns those types, and the real read layer returns the same types. A user interface
that works against the mock therefore works against the database.

`src/db/schema.ts` is generated from `public`. Only the backend imports it. A lint rule stops
the user interface importing it.

The generator is **not named here**. Naive introspection tools break on a `geometry` column
and on a `vector` column, and no candidate is proven yet. See **#26**.

## Consequences

- Every new read needs a view before the user interface can use it. That is the cost, and it
  is the point.
- One rule is still expressed twice, per T6 — a Zod schema and a `CHECK`. The Zod schema for
  a read is generated, so only the write side is written twice.
- `schema.md` §15 is superseded in substance: its grant on `entities`, `relations`,
  `documents`, `proposals` and `layers` becomes a `REVOKE` on `public` plus grants inside
  `api`. That document stays provisional and stays an illustration.
- The three commands of §4 assume the containers of ADR 0002. The two ADRs are one runtime.

## Not decided here

- **Which generator** produces the types — **#26**. It also adds the drift step to
  `pnpm check`, and amends ADR 0001 §3 when it closes.
- **Whether the read HTTP layer is generated or hand-written** — #6. This ADR fixes what such
  a layer generates *from*, not whether it is generated.
- **The DDL itself.** No table, no column, no constraint and no trigger is decided by this
  ADR. `schema.md` stays provisional. The real schema is written in the migration files, when
  the build needs it, and it must satisfy `spec.md` §2.
- **The test runner** — #24. §5 says what a migration test runs against, not what runs it.
