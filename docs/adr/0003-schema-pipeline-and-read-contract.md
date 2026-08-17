# ADR 0003 — Schema pipeline and the read contract

**Status** Accepted · 11 August 2026

### 1. SQL is the only source of truth

The `.sql` files are the schema. Nothing else is. TypeScript types are **generated** from the live
database by introspection: no column name is written twice, and no type is written by hand. A drift
check regenerates them and fails if the result differs from what is committed — ADR 0001 §3 carries
that step. **Drift is a failing build, not a discipline.**

A TypeScript-first tool that writes the SQL is **rejected**: SQL expresses every object this
project puts in the database — triggers, the traversal function, the promotion transaction, PostGIS
and pgvector types — and a TypeScript schema language expresses a subset. A subset gives two
sources of truth.

### 2. `node-pg-migrate` applies the ordered files

An npm dependency, so no second binary is installed. **It was not run.** If its SQL support does
not match §3, replace the tool and keep §3: the file convention is the decision, and the tool is
the smaller half.

### 3. Ordered files, and re-runnable files

| Kind | Where | Runs |
|---|---|---|
| Tables, columns, indexes, roles, extensions, **types** | `db/migrations/` | Once, in order, each in a transaction |
| Views, functions, triggers, grants | `db/apply/` | Every run, each file holding its whole current definition |

A table holds data, so its change must run once. A function holds none, so its whole text can be
replaced on every run. **A table is never re-runnable.**

Two traps, both measured:

- **A trigger.** A plain second `CREATE TRIGGER` fails on the second apply. Write
  `CREATE OR REPLACE TRIGGER`.
- **A type or a domain.** A column's type cannot be replaced and a domain a `CHECK` depends on
  cannot be dropped, so a type is **ordered** and lives beside the table that uses it. The same
  reaches a `CHECK` that calls a function: `db/migrations/` runs before `db/apply/`, so a function
  a constraint depends on is schema and belongs in the ordered file.

`db/apply/` runs in this order: the `api` schema, views, functions, triggers, grants.

### 4. Three commands reach the current state, from zero

```
docker compose -f infra/docker-compose.yml up -d    the database exists and is empty
pnpm db:migrate                                     ordered files, 0001 upward
pnpm db:apply                                       re-runnable files, every one
```

No baseline dump, and no step applied by hand. `pnpm db:reset` destroys the volume and runs the
three again. **They enter `package.json` with the first migration.**

### 5. A migration is tested against an empty database, never against real data

`pnpm db:reset`, then the three commands, then the tests.

### 6. Two schemas. The read role never touches a base table

| Schema | Holds | `gabriel_read` gets |
|---|---|---|
| `public` | The base tables | Nothing. Not even `USAGE`. |
| `api` | Views and functions built for reading | `USAGE`, `SELECT` on the views, `EXECUTE` on the functions |

**A grant inside `api` is not always a read.** A view is auto-updatable and runs with the rights of
**its owner**, so a write grant on a view passes every `REVOKE` on `public`. This was measured: a
role with no privilege on `public.entities` wrote a row through an ordinary `api` view. Two lines
in the grants file are the perimeter:

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA api FROM gabriel_read;
```

It covers every view, including the ones nobody has written yet, and it re-runs on every apply, so
a convenience grant is erased rather than inherited. Each view also carries
`WITH (security_invoker = true)` as the **second layer, not the guard**.

Two traps recorded so the next reader does not repeat them. `default_transaction_read_only` is
`USERSET`, so the same session turns it off. And a probe built on a `serial` key **passes for an
unrelated reason** — test with `uuid` or the test proves nothing.

**One view per concept, not per surface.** A surface-shaped view multiplies with the user
interface. Graph traversal stays a function, per T4. **No read of data passes through the Node
backend.**

### 7. Four roles, so a write is held by a grant and not by a prompt

| Role | Writes |
|---|---|
| `gabriel_owner` | Nothing by connecting. It **owns** the tables and the write functions and never logs in |
| `gabriel_app` | No table directly. It calls the write functions, and nothing else |
| `gabriel_agent` | The candidate layer only. Never the evidentiary layer, never the configuration layer |
| `gabriel_read` | Nothing. `USAGE`, `SELECT` and `EXECUTE` inside `api` only |

**The rule is by layer, not by table name.** The four role names are fixed here; the tables that
carry each layer are fixed by the first migration.

### 8. The generator is Kanel, and it holds two folders

`src/contract/` is generated from the `api` schema, and the user interface imports it. `src/db/` is
generated from `public`, and **no file under `src/` may import `src/db/`**.

Kanel writes one file per relation, inside a folder named after the schema. It was chosen by
measurement against a database holding `geometry`, `geography`, `vector` and `jsonb`: with its type
map it emits GeoJSON `Point` and `number[]`, where pg-to-ts emits `any` for everything it does not
know.

A mock and the database agree on **shape** and not on behaviour.

### 9. PostgREST serves the `api` schema

The read HTTP layer is **generated, not hand-written**. §6 already built what a generated layer
needs. **A generated layer cannot widen the allowlist, because the layer does not hold it** — the
grants of `gabriel_read` do, and PostgREST connects as that role. To add a read, write a view.

**One tension, recorded and not hidden.** PostgREST is not TypeScript, and T1 asks for TypeScript
end to end. It is read here as a **service**, like PostgreSQL and the object store.

**Two reads return everything and cannot carry the default `LIMIT`** — the full-graph view and the
full map view. They are exempt, and the mechanism of that exemption is open. The 5s
`statement_timeout` still applies to both.
