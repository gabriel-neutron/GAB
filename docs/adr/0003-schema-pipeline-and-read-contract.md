# ADR 0003 — Schema pipeline and the read contract

**Status** Accepted · 11 August 2026

## SQL is the source of truth

The SQL files in `db/` are the schema. TypeScript types are generated from the live database. Nobody
writes a column name twice or writes a database type by hand. The drift check of ADR 0001 fails CI
when the generated types differ from the committed types.

We refuse a TypeScript-first schema tool. SQL can express each object of this project: triggers,
functions, PostGIS and pgvector types. A TypeScript schema language expresses only a part of them,
and a part gives two sources of truth.

One exception: the seeded type vocabulary is declared in TypeScript. A tool generates its SQL rows
from that declaration.

## Ordered files and re-runnable files

`node-pg-migrate` applies the files. The file convention is the decision. If the tool does not fit
the convention, replace the tool and keep the convention.

- **Ordered migrations** hold what holds data or what other objects depend on: tables, columns,
  indexes, roles, extensions and types. Each one runs once, in order, in a transaction. A function
  that a constraint calls is also schema, so it goes in an ordered file.
- **Re-runnable files** hold views, functions, triggers, grants and seed rows. Each run applies all
  of them. Each file holds the full current definition. Seed rows only add and update, never
  delete.

From an empty database, the migrations and then the re-runnable files give the current state, with
no baseline dump and no step by hand.

We test a migration on the test database, built again from zero, never on real data.

## Two schemas, and the read role never touches a base table

The base tables are in `public`. The read role has no right on `public`. The `api` schema holds
views and functions made for reading. The read role can only use `api`.

A view in `api` runs with the rights of its owner, so it is the only door into `public`. But an
updatable view can also write with those rights. Thus a grant inside `api` is not always a read. The
grants file revokes each write on each object of `api` from each role other than the owner. It runs
again on each apply, so it also covers a view that somebody adds later. This revoke is the only
guard.

A view does not use `security_invoker`: the option checks `public` with the rights of the read role,
and so it refuses the read too.

Make one view for each concept, not for each screen. No read of data goes through a Node backend.

## Roles by layer

A grant, not a prompt, controls each write. The rule is by layer, not by table:

- The **owner** role owns the tables and the write functions. It never logs in.
- The **application** role writes only through the write functions.
- The **machine** roles can only propose into the candidate layer. They never write the evidence
  layer or the configuration layer. Only the operator promotes.
- The **read** role reads the public views of `api` and nothing more. A view is public only when
  the grants file names it for the read role.

## Generated types and the read layer

Kanel generates the types of `api` into one folder, and the user interface imports it. No type is
generated from `public`, because no code used those types. We chose Kanel by a test with geometry,
vector and JSON columns: it gave useful types where the other tool gave `any`.

PostgREST serves the `api` schema over HTTP as the read role. This generated layer cannot widen what
a reader sees, because the grants of the read role hold that limit. To add a read, write a view. ADR
0008 tells how a large read is bounded.

## Cost

- PostgREST is not TypeScript, but `spec.md` T1 asks for TypeScript end to end. We treat
  PostgREST as a service, like PostgreSQL and the object store.
- The drift check applies the re-runnable files to the test database before it compares, so it
  needs a test database that is built from the current migrations.
- Nothing tells a test run that the test database is older than the record. Build it again after
  each new migration.
