# ADR 0002 — Local runtime and data stores

**Status** Accepted · 7 August 2026

## Context

`decisions.md` T2 makes PostgreSQL with PostGIS the single datastore of record. T5 puts pgvector in
the same database. T3 keeps each raw file, unchanged, in an S3 store. The operator develops on
Windows and is not a Docker expert.

## Decision

**One Compose file runs all services.** `infra/` holds it. It runs the database, the raw store and
the services that serve them. Docker Desktop is the graphical tool: it shows the containers, their
logs and their volumes. We add no second container manager.

**We build the database image.** No published image has PostGIS and pgvector together. Our image
adds pgvector to the PostGIS image. On a new volume, the base image already creates PostGIS. Thus a
migration that creates an extension must accept that the extension can already exist. A migration
creates pgvector together with the first column that needs it.

**The raw store is SeaweedFS, with one private bucket.** The bucket keeps each source file exactly
as it arrived. Nobody can read it anonymously. A reader gets the original source address, a public
web-archive address and the file hash, which ingest records. ADR 0007 tells when the raw store
moves.

**Each service listens on the loopback address only.** No port is open to a public address.

**Each image tag is pinned.** An upstream change must arrive through a commit, not through a
restart.

**Data lives in named volumes.** The data stays after the services stop. Only the explicit volume
reset removes it.

**The cluster holds two databases: the record and a test database.** The reset command builds the
test database again and never touches the record. A test run refuses all databases other than the
test database. T2 stays true, because both databases are in one datastore.

**Secrets stay out of git.** A committed example file names each variable. The real file holds the
values and git ignores it.

**The application uses its own S3 account, never the admin account.** This account can put a file
and list the bucket. It cannot read, delete or make the bucket public. Thus an error in ingest code
cannot remove a source file. The admin account is for the tests only.

## Reason

One Compose file and Docker Desktop give the operator one tool to start, see and stop all services.
A built image is the only way to get both extensions in one database. A private bucket does not
publish files that other persons own. Loopback ports, pinned tags and a narrow S3 account each
remove a risk at a low cost.

The test database exists because live tests wrote invented rows into the record.

## Cost

- Docker Desktop must run before anything works.
- The container is portable, but the database is not. Each future target must have PostGIS and
  pgvector. SQLite and MySQL are excluded while T2 and T5 stand.
- Each entry point loads the full environment file. Thus the admin keys are in the same process as
  the application keys. The S3 account limits the client, not the process.
- A put to a key that exists replaces the old object. The application account cannot delete a file,
  but it can overwrite one. T3 keeps the raw file unchanged by convention only. The bucket has no
  versioning and no object lock, and this is intentional.
