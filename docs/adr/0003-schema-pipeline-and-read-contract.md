# ADR 0003 — Schema pipeline and the read contract

**Status** Accepted · **Version** 3 · 10 August 2026
**Tickets** #22 (closed by this ADR), #23 (closed by this ADR), #6 (closed by version 2),
#24 (closed by ADR 0001 v3)

**Version 3** names the generator in §1 and rewrites §8. Version 2 left the generator open
because none had been tested. One has now been tested, against a throwaway database that was
never committed, so §8 rests on measurement and no longer on trust. Rewriting in place is
still permitted, because no code exists under this ADR: `db/` holds `README.md` only, no DDL
is written, and neither generated folder exists. **ADR 0001 §3 is amended by this version**
and now runs four steps. Nothing in §2 to §7 and §9 changed.

**Version 2** added §9 and amended §6. It named the read HTTP layer, which version 1 left
open, and recorded that two reads cannot carry a default `LIMIT`. Nothing in versions 1 §1 to
§8 changed at that time.

**Resolves** the `db/` row of the "Deliberately absent" table in ADR 0001. `db/` is created.
`src/contract/` and `src/db/` stay absent until the first migration exists, because a
generator with no table to read produces nothing. The rest of ADR 0001 stays true and stays
Accepted.

## Table of contents

- [Context](#context)
- [Decision](#decision)
  - [1. SQL is the only source of truth](#1-sql-is-the-only-source-of-truth)
  - [2. `node-pg-migrate` applies the ordered files](#2-node-pg-migrate-applies-the-ordered-files)
  - [3. Ordered files, and re-runnable files](#3-ordered-files-and-re-runnable-files)
  - [4. Three commands reach the current state, from zero](#4-three-commands-reach-the-current-state-from-zero)
  - [5. A migration is tested against an empty database](#5-a-migration-is-tested-against-an-empty-database-never-against-real-data)
  - [6. Two schemas. The read role never touches a base table](#6-two-schemas-the-read-role-never-touches-a-base-table)
  - [7. Three roles](#7-three-roles-so-an-agent-is-held-by-a-grant-and-not-by-a-prompt)
  - [8. The generator is Kanel, and it holds two folders](#8-the-generator-is-kanel-and-it-holds-two-folders)
  - [9. PostgREST serves the `api` schema](#9-postgrest-serves-the-api-schema-version-2)
- [Consequences](#consequences)
- [Not decided here](#not-decided-here)

## Context

`spec.md` §6 held two open questions. #22 asked which tool applies the DDL, and in what
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

That check belongs in `pnpm check`. **ADR 0001 §3 is amended by this version and now runs
four steps.** The step needs a running database, and that cost is recorded there.

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

### 7. Three roles, so an agent is held by a grant and not by a prompt

| Role | Writes |
|---|---|
| `gabriel_app` | Everything the backend needs, promotion included |
| `gabriel_agent` | The candidate layer only — proposals, and the chunk and embedding tables. Never the evidentiary layer. |
| `gabriel_read` | Nothing. `USAGE`, `SELECT` and `EXECUTE` inside `api` only. |

**The rule is by layer, not by table name.** No schema is decided, so the table names that
carry each layer are fixed when the first migration is written. The three role names are
fixed here.

An agent holds no database password. It reaches the database only through the backend, and
whatever the backend exposes to it connects as `gabriel_agent`. **What those tools are is not
decided here.** The AI work is open, and the tracker carries it. A prompt is not a permission.

**This constrains the agent. It does not enforce invariant 5.** `gabriel_app` still writes the
evidentiary layer, so a fault in the backend can still put a row there without a promotion.
**The enforcement tier for invariant 5 stays open**, the tracker carries it, and `spec.md` §2
still records it as undecided. This ADR narrows the hole. It does not close it.

### 8. The generator is Kanel, and it holds two folders

`src/contract/` is generated from the `api` schema. The user interface imports it. `src/db/`
is generated from `public`. **No file under `src/` may import `src/db/`**, because no backend
exists yet under `src/`.

The mock returns the contract types, and the real read layer returns the same types, so the
mock and the database agree on **shape**. They do not thereby agree on behaviour: a mock says
nothing about what the database returns for a given row, about ordering, or about an empty
result. This removes one class of surprise, not all of them.

**Two folders, not two files.** Kanel writes one file per relation, inside a folder named
after the schema. Version 2 of this ADR named `src/contract/api.ts` and `src/db/schema.ts`.
No generator produces those two files, so the names are withdrawn.

**The choice is measured, not taken on trust.** Three candidates were run or read against a
throwaway database holding a `geometry`, a `geography`, a `vector` and an M7-shaped `jsonb`
column. That database was never committed, and it decided no schema.

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

### 9. PostgREST serves the `api` schema (version 2)

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

- **The DDL itself.** No table, no column, no constraint and no trigger is decided by this
  ADR. `schema.md` stays provisional. The real schema is written in the migration files, when
  the build needs it, and it must satisfy `spec.md` §2. **No ticket owned the first migration
  until 10 August 2026. One does now, and the tracker carries it.**
- **The Zod major**, which §8 records as open.
- **The test policy.** The runner is Vitest, settled by ADR 0001 §4 version 3. §5 says what a
  migration test runs against, not what must be tested.
