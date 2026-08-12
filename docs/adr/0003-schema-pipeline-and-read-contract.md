# ADR 0003 — Schema pipeline and the read contract

**Status** Accepted · 11 August 2026
**Tickets** #22 (closed by this ADR), #23 (closed by this ADR), #6 (closed by this ADR),
#24 (closed by ADR 0001 §4)

Every measurement below was made against a throwaway PostgreSQL 17.5 database, which was never
committed and decided no schema. **No fault recorded here was visible by reading.**

## Table of contents

- [Context](#context)
- [Decision](#decision)
  - [1. SQL is the only source of truth](#1-sql-is-the-only-source-of-truth)
  - [2. `node-pg-migrate` applies the ordered files](#2-node-pg-migrate-applies-the-ordered-files)
  - [3. Ordered files, and re-runnable files](#3-ordered-files-and-re-runnable-files)
  - [4. Three commands reach the current state, from zero](#4-three-commands-reach-the-current-state-from-zero)
  - [5. A migration is tested against an empty database](#5-a-migration-is-tested-against-an-empty-database-never-against-real-data)
  - [6. Two schemas. The read role never touches a base table](#6-two-schemas-the-read-role-never-touches-a-base-table)
  - [7. Four roles](#7-four-roles-so-a-write-is-held-by-a-grant-and-not-by-a-prompt)
  - [8. The generator is Kanel, and it holds two folders](#8-the-generator-is-kanel-and-it-holds-two-folders)
  - [9. PostgREST serves the `api` schema](#9-postgrest-serves-the-api-schema)
- [Consequences](#consequences)
- [Not decided here](#not-decided-here)

## Context

Two open questions were held on the tracker. #22 asked which tool applies the DDL, and in what
order. #23 asked what the read-only role selects from. Both gate real work: #22 gates the
first line of SQL, and #23 gates the contract the UI is written against.

Three constraints already decided make this one decision, not two:

- **T6** puts a `CHECK` constraint in the database. **`spec.md` §4** puts the graph traversal
  in a SQL function. M4 and S2 need triggers, and `spec.md` §5 makes a promotion one
  transaction. #22 records that all of these are SQL. A large part of the system's rules is
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

That check belongs in `pnpm check`, and **ADR 0001 §3 carries it**. The step needs a running
database, and that cost is recorded there.

A TypeScript-first tool that writes the SQL — Drizzle Kit and its family — is **rejected**.

The reason is the operator's requirement, and it holds whatever the tool supports: with a
TypeScript-first tool the schema is declared twice, once in TypeScript and once in whatever
the tool cannot express, and the two must be kept in step by hand. The objects this project
puts in the database are the awkward ones: triggers, the traversal function, the promotion
transaction, `CHECK` constraints from T6, and PostGIS and pgvector column types.

**The support these tools have for those objects was not measured.** Drizzle has shipped some
geometry and vector support, so "it cannot express them" would be too strong a claim to write
here. The decision does not rest on it. It rests on this: SQL can express every object, a
TypeScript schema language expresses a subset, and a subset gives two sources of truth.

### 2. `node-pg-migrate` applies the ordered files

It is an npm dependency, so ADR 0001 keeps one package and pnpm, and no second binary is
installed on the machine. It is reported to run plain SQL migration files, which is the whole
requirement.

**This tool was not installed and not run.** It is a choice on paper. If its SQL support does
not match §3, replace the tool and keep §3 — the file convention is the decision here, and
the tool is the smaller half of it.

### 3. Ordered files, and re-runnable files

| Kind | Where | Runs |
|---|---|---|
| Tables, columns, indexes, roles, extensions | `db/migrations/` | Once, in order, each in a transaction |
| Views, functions, triggers, grants | `db/apply/` | Every run, in a fixed order, each file holding its whole current definition |

A table holds data, so its change must be ordered and must run once. A function holds no data,
so its whole text can be replaced on every run. Keeping two copies of a `CREATE TABLE` — one
ordered and one re-runnable — gives two places to edit, so a table is never re-runnable.

**Two objects break the re-runnable rule if they are written plainly.**

- **A trigger.** A second plain `CREATE TRIGGER` raises `trigger ... already exists`, so it
  fails on the second `pnpm db:apply`. Write `CREATE OR REPLACE TRIGGER`, which PostgreSQL 14
  and later supports and which was measured to run clean twice on 17.5. `schema.md` uses the
  plain form throughout, and that illustration no longer applies.
- **A domain, and any type.** A type holds no data, but a column's type cannot be replaced,
  and a domain that a `CHECK` depends on cannot be dropped. A type is therefore **ordered**,
  and it lives in `db/migrations/` beside the table that uses it.

The same rule reaches a `CHECK` that calls a function: `db/migrations/` runs before
`db/apply/`, so a constraint cannot call a function that `db/apply/` has not created yet.
Measured — the migration fails on a fresh machine. A function a constraint depends on is
schema, and it belongs in the ordered file.

`db/apply/` runs in this order: the `api` schema, then views, then functions, then triggers,
then grants.

### 4. Three commands reach the current state, from zero

**These commands are defined here, and they enter `package.json` with the first migration.** A
command that runs no file reports success and does nothing.

```
docker compose -f infra/docker-compose.yml up -d    the database exists and is empty
pnpm db:migrate                                     ordered files, 0001 upward
pnpm db:apply                                       re-runnable files, every one
```

A new machine runs those three lines. There is no baseline dump, and there is no step applied
by hand. At the target volumes — 1 to 10k entities, 100 to 1k documents — a full replay is
expected to take seconds, and that expectation is not measured. **Measure it before the file
count grows.** If a replay ever becomes slow, the answer is a squashed baseline, and that is a
change to this ADR.

`pnpm db:reset` will destroy the volume and run the three lines again.

### 5. A migration is tested against an empty database, never against real data

`pnpm db:reset`, then the three commands, then the tests. A migration is never first applied
to data that matters.

### 6. Two schemas. The read role never touches a base table

| Schema | Holds | `gabriel_read` gets |
|---|---|---|
| `public` | The base tables | Nothing. Not even `USAGE`. |
| `api` | Views and functions built for reading | `USAGE` on the schema, `SELECT` on the views, `EXECUTE` on the functions |

A grants file in `db/apply/` will revoke everything on `public` from `gabriel_read`, then
grant inside `api` only. It runs last, so it always states the current perimeter.

**A grant inside `api` is not always a read.** A view is auto-updatable, and it
runs with the rights of **its owner** and not of the caller. The owner of the views is also
the owner of the base tables, so a write grant on a view passes every `REVOKE` on `public`.
This was measured: `gabriel_read`, with no privilege on `public.entities`, wrote a row through
an ordinary `api` view. A `REVOKE` of everything on `public` did not stop it, because the view
does not read the rights of the caller.

Two lines in the same grants file close it, and they are the perimeter:

```sql
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA api FROM gabriel_read;
```

That statement covers every view, including the ones nobody has written yet, and the file
re-runs on every `db:apply`, so a convenience grant is erased rather than inherited.

Each view also carries `WITH (security_invoker = true)`. It is the **second layer, not the
guard**: it must be typed on every new view for ever, adding a read is the normal weekly act
under this section, and forgetting it raises nothing at the time.

Two traps recorded so the next reader does not repeat them. A read-only session parameter is
not a substitute — `default_transaction_read_only` is `USERSET`, so the same session turns it
off, measured. And a probe built on a `serial` key **passes for an unrelated reason**, because
the sequence behind the default is checked against the caller. `schema.md` uses `uuid`
throughout, which does not mask the fault. Test this with `uuid` or the test proves nothing.

**One view per concept, not per surface.** A surface-shaped view multiplies with the user
interface. A concept-shaped view does not. Graph traversal stays a function, per T4.

The operator owns the views and the functions. They are re-runnable files in `db/apply/`, so
§3 applies them on every run. No view is created outside that folder.

A view keeps its output the same while the table under it changes. A base table has no such
gap. Grant on base tables, and the shape of a table becomes the shape of the user interface.
Then a column for the origin of a row is added. PU1 requires that origin on every claim that
is shown. The change then reaches every component that reads that table.

**No read of data passes through the Node backend.** A view lives inside the database, so it
adds no hop and no service. T4 is unaffected by this ADR. Reaching a stored source file is a
separate question, and it is settled: **#31 is closed.** The bucket stays private and has no
external read path. A reader is given the original source URL, a public web-archive URL and
the file hash, all recorded at ingest. ADR 0002 §3 holds that decision.

### 7. Four roles, so a write is held by a grant and not by a prompt

| Role | Writes |
|---|---|
| `gabriel_owner` | Nothing, by connecting. It **owns** the tables and the write functions, and it never logs in. `NOLOGIN`, `NOINHERIT`, and no role is a member of it. |
| `gabriel_app` | No table directly. It calls the write functions, and nothing else. |
| `gabriel_agent` | The candidate layer only — proposals, and the chunk and embedding tables. Never the evidentiary layer, and never the configuration layer. |
| `gabriel_read` | Nothing. `USAGE`, `SELECT` and `EXECUTE` inside `api` only. |

**The rule is by layer, not by table name.** No schema is decided, so the table names that
carry each layer are fixed when the first migration is written. The four role names are fixed
here.

**The rule needs three layers, not two.** A candidate layer and an evidentiary layer are the
two that are obvious. A third layer holds the agents, the workflows and their steps, and it
must be named here as well: a role table that does not name a layer grants nothing and forbids
nothing there.

| Layer | Holds | Written by |
|---|---|---|
| Configuration | The agents, the workflows and their steps | The **owner**, through a migration or a seed file |
| Candidate | Proposals, chunks, embeddings, runs and calls | `gabriel_agent` |
| Evidentiary | Entities and relations | Nothing. A `SECURITY DEFINER` function only |

`gabriel_app` and `gabriel_agent` get `SELECT` on the configuration layer and nothing more.
The reason is measured: with `INSERT` on `agents`, `gabriel_agent` wrote a new agent row and
then named that row as the cause of its own work. **A prompt that an agent wrote for itself
is not a record of what produced a claim.** After `REVOKE INSERT`, the same insert was
refused.

**A grant is not sufficient on this layer.** A table owner ignores a column grant, and a
`SECURITY DEFINER` function that obeys every rule above rewrote an agent prompt. The
configuration tables are therefore **append-only by trigger**: a `BEFORE UPDATE OR DELETE`
trigger refuses the whole row, and it held where the grant did not. The tracker carries the
shape of those tables.

An agent holds no database password. It reaches the database only through the backend, and
whatever the backend exposes to it connects as `gabriel_agent`. **What those tools are is not
decided here.** The AI work is open, and the tracker carries it. A prompt is not a permission.

**The enforcement tier for invariant 5 is decided here: a privilege boundary. The tracker
carries the measurement, and the proof waits on the first migration.** The short form:

- No role holds `INSERT`, `UPDATE` or `DELETE` on the evidentiary tables. `gabriel_owner`
  owns them. No grant limits the owner of a table, and that is why nothing connects as it.
- Every write is a `SECURITY DEFINER` function owned by `gabriel_owner`, carrying
  `SET search_path = pg_catalog, public, pg_temp`, with `EXECUTE` revoked from `PUBLIC` and
  granted to `gabriel_app` alone.
- **`gabriel_app` loses `INSERT` and `UPDATE` on `proposals` too.** This is the part that
  matters. While one role can write a proposal and also promote it, no constraint in the
  database can tell a true promotion from a false one. It was measured: a proposal written and
  promoted in one transaction produced a row that said a person had decided.
- **One door, and it is countable.** Each evidentiary row carries the identifier of the
  proposal that produced it. That column is `NOT NULL UNIQUE`, so one proposal makes one row,
  and a second promotion of the same proposal fails on the key.
- **The database witnesses a role, never a human.** `current_user` inside a `SECURITY
  DEFINER` function is the function owner, so a column that defaults to it records one
  constant. `session_user` is the real caller, and it separates `gabriel_agent` from
  `gabriel_app` and nothing finer. A proposal therefore carries the writing role in a column
  that a `BEFORE INSERT` trigger sets from `session_user` on every row. It is a witness and
  never an input: measured, a caller that supplied a different value stored its own role. Any
  recorded origin says which role wrote the proposal, and says no more than that.

**Four rules follow, and each one is a defect if it is broken.**

1. **No role is ever made a member of `gabriel_owner`.** Membership defeats the design, and
   `NOINHERIT` is not a substitute. Measured: with `INHERIT FALSE` the privilege test returns
   false, and a plain `SET ROLE` then writes the table.
2. **Every `SECURITY DEFINER` function carries `SET search_path`.** Without it, the function
   writes into a temporary table that the caller made, and it reports success. Measured.
   PostgreSQL makes such a function with no message, so a catalog query finds the fault and a
   review does not.
3. **The identity that applies `db/apply/` decides who owns a new function.** `CREATE OR
   REPLACE` on a function that exists keeps its owner. The first `CREATE` of a new file gives
   the function to the connected identity. One connection string therefore decides if the
   promotion function runs as a superuser.
4. **Every ordered file opens with `SET LOCAL ROLE gabriel_owner`.** The ordered files run as
   the superuser, because an extension needs one. Measured: `CREATE EXTENSION` as
   `gabriel_owner` is refused. Without the role change, every table the migration makes is
   owned by the superuser, and §7 then owns nothing. Use `SET LOCAL`: measured, a plain
   `SET ROLE` lives through the `COMMIT` and reaches the next file on the same connection.

**What this section still does not close.** `infra/docker-compose.yml` creates
`POSTGRES_USER: gabriel`, a superuser, and a superuser passes every grant here. That account
is for the first start and for the ordered migrations. Nothing else connects as it. ADR 0002
carries that separation.

### 8. The generator is Kanel, and it holds two folders

`src/contract/` is generated from the `api` schema. The user interface imports it. `src/db/`
is generated from `public`. **No file under `src/` may import `src/db/`**, because no backend
exists yet under `src/`.

The mock returns the contract types, and the real read layer returns the same types, so the
mock and the database agree on **shape**. They do not thereby agree on behaviour: a mock says
nothing about what the database returns for a given row, about ordering, or about an empty
result. This removes one class of surprise, not all of them.

**Two folders, not two files.** Kanel writes one file per relation, inside a folder named
after the schema. No generator produces one file per schema, so nothing here names one.

**The choice is measured, not taken on trust.** Three candidates were run or read against a
throwaway database holding a `geometry`, a `geography`, a `vector` and an M7-shaped `jsonb`
column.

| Candidate | `geometry` | `geography` | `vector` |
|---|---|---|---|
| Kanel, with its type map | GeoJSON `Point` | GeoJSON `Point` | `number[]` |
| Kanel, with no type map | `unknown` | `unknown` | `unknown` |
| pg-to-ts | `any` | `any` | `any` |
| `drizzle-kit pull` | correct | a placeholder that does not compile | correct |

pg-to-ts emits `any` for every type it does not know, offers no override, and had no release
for about three years. `drizzle-kit pull` has no `geography` type at all, and its introspector
has no override, so the file must be repaired by hand after every run. A file repaired by hand
cannot carry a drift check.

**Six rules follow from the measurement. Each one is a defect if it is broken.**

1. **Four types are mapped by hand, twice.** Kanel maps `geometry`, `geography`, `vector` and
   `jsonb` to `unknown` on its own. The type map fixes the types and a second map fixes the
   Zod schemas. Two maps must state the same rule, and keeping them in step is the cost of
   this choice.

   **A fifth entry, in the Zod map only.** A document identifier is a domain, and
   a column holds an array of it. Measured: the TypeScript output is already correct and needs
   no entry, but the Zod output drops the array and gives the element schema alone. A plain
   `text[]` in the same run is correct, so the fault belongs to the array of a domain. The
   generated Zod then disagrees with the generated TypeScript, a cast hides the disagreement
   from `tsc`, and **the drift check cannot see it, because the wrong output is the same on
   every run.** One line in the Zod map repairs it, and it must land with the domain.
2. **The `jsonb` map states M7 and nothing else.** PostgreSQL carries no shape for `jsonb`, so
   no generator can find one. M7 is locked, so the shape is known. This is the only type
   written by hand in the whole pipeline. It is permitted because it is not a column name, so
   it cannot drift from one.
3. **A view must state its nullability in SQL.** PostgreSQL reports every column of every view
   as nullable, whatever the base column says, and the generator then types every one as
   present. A contract that promises a value which can be absent is worse than no contract.
   The view, and not the generator, carries this.
4. **Views are read as views, and never resolved to their base tables.** Resolving them makes
   the generator write `public` types into the contract folder and import across the two. That
   is the boundary §6 exists to hold.
5. **The generator runs the formatter after it.** Kanel runs no formatter and writes the line
   endings of the host machine. Development is Windows only, so it writes CRLF, and the format
   check of ADR 0001 §3 requires LF. A formatting pass after generation makes the output pass
   the check, and makes it identical on every run.
6. **The two folders are declared in the lint configuration.** A folder that nobody declares
   fails the lint on purpose. `src/contract/` is declared and the user interface may import
   it. `src/db/` is declared and nothing may import it, because the default is refusal and no
   rule permits it. This is the whole of the lint requirement: two declarations, and one
   permission.

**The Zod major is open, and the tracker carries it.** The Zod half of this section rests on a
package that declares no Zod version and emits Zod 4.

### 9. PostgREST serves the `api` schema

The read HTTP layer is **generated, not hand-written**. #6 asked which, and §6 above had
already built what a generated layer needs: an `api` schema, one view per concept, functions,
and a role whose grants are the whole perimeter.

**A generated layer cannot widen the allowlist, because the layer does not hold it.** The
grants of `gabriel_read` hold it. PostgREST connects as that role, so it sees what the role
sees and nothing more. `statement_timeout` is set on the role with `ALTER ROLE`, so it applies
whatever issues the query. To add a read, write a view — §3 applies it on every run.

A hand-written Node service was refused: it is code that only relays `SELECT`s, which is the
dead weight T4 names, and it puts a Node process back in the read path that T4 removed.

**One tension, recorded and not hidden.** PostgREST is not TypeScript, and T1 asks for
TypeScript end to end. It is read here as a **service**, like PostgreSQL and the object store,
and not as code this project writes — the category T1's own consequence anticipates. A reader
who rejects that reading must replace this section, and must quote T1 when doing so.

**Two reads return everything, and cannot carry the default `LIMIT`.** The full-graph view and
the full map view exist to be complete; a page of rows makes both meaningless. They are
exempt. `spec.md` §4 keeps the default `LIMIT` for every other read. **The mechanism of the
exemption, and the measurement that proves it safe at 10k entities and 25k relations, are
open. The tracker carries them.**

The 5s `statement_timeout` still applies to both. It bounds one query and not a loop of them;
a rate limit belongs with a deployment, which does not exist.

## Consequences

- Every new read needs a view before the user interface can use it. That is the cost, and it
  is the point.
- One rule was expressed twice, per T6 — a Zod schema and a `CHECK`. The generator of §8
  emits Zod as well as types, so the read side is no longer written twice. **The saving is
  real, and it is paid for.** The two type maps of §8 must state the same rule, so one hand
  written pair replaces one hand written pair. What is gained is that no column name is
  written twice.
- `schema.md` §15 is superseded in substance: its grant on `entities`, `relations`,
  `documents`, `proposals` and `layers` becomes a `REVOKE` on `public` plus grants inside
  `api`. That document stays provisional and stays an illustration.
- The three commands of §4 assume the containers of ADR 0002. The two ADRs are one runtime.

## Not decided here

- **The DDL itself.** No table name and no column name is decided by this ADR. `schema.md`
  stays provisional. The real schema is written in the migration files, when the build needs
  it, and it must satisfy `spec.md` §2. **The tracker carries the first migration.** §7 decides
  where a privilege boundary and an append-only trigger must stand. It does not decide the
  tables they stand on.
- **The Zod major**, which §8 records as open.
- **The test policy.** The runner is Vitest, settled by ADR 0001 §4. §5 says what a
  migration test runs against, not what must be tested.
