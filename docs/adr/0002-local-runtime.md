# ADR 0002 — Local runtime and data stores

**Status** Accepted · 7 August 2026

T2 makes PostgreSQL/PostGIS the single GOLD datastore, T5 puts pgvector in that same database, and
T3 puts the raw file, unchanged by convention, in an S3 store. So the first build runs two services. Development
happens on **Windows only**, for one operator who is not a Docker expert.

### 1. One Compose file, two services

`infra/docker-compose.yml` runs `db` and `seaweedfs`. Docker Desktop is
already on the machine and its window lists the containers, their logs and their volumes, so it is
also the graphical tool. **No second manager is added.**

### 2. The database image is built, not taken as-is

The two obvious images each carry one extension and not the other. The Dockerfile is three lines:

```dockerfile
FROM postgis/postgis:17-3.5
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-17-pgvector \
 && rm -rf /var/lib/apt/lists/*
```

Proven on 7 August 2026: PostgreSQL 17.5, PostGIS 3.5.2, pgvector 0.8.6.

**One behaviour of the base image, recorded because it surprises.** On a fresh volume PostGIS is
already created and pgvector is installed but not created. **A migration that creates either must
use `CREATE EXTENSION IF NOT EXISTS`, and must not assume an empty extension list.**

**pgvector arrives with the first vector column, not with the first migration.** Amended
28 September 2026. `db/migrations/0001_extensions_and_roles.sql` creates `postgis` and `pg_trgm`
only, because no table holds a `vector` column yet. The migration that adds the first one creates
the extension in the same file, ordered beside the column it serves, per ADR 0003 §3.

### 3. One bucket, private

`raw` holds the original file exactly as it arrived. It is private, and there is no anonymous read.
An open bucket re-publishes every source file, and a collected corpus holds files that someone else
owns the rights to.

**A reader is given the original source URL, a public web-archive URL and the file hash**, all
recorded at ingest. PU1 governs the claims and their citations, not the bytes.

### 4. Ports on the loopback address only

`127.0.0.1:5432` for the database, `127.0.0.1:9000` for the S3 API. The S3 port is the only port of the raw
store that leaves the container, and nothing is bound to a public address. The admin UI is off.

### 5. Every image tag is pinned

Never `latest`. An upstream change must arrive through a commit, never through a restart.

### 6. Named volumes, and one reset command

`gab-db-data` and `gab-raw-data`. Data survives `docker compose down`, and is destroyed by
`docker compose down -v` and by nothing else.

**The cluster holds two databases: `gabriel`, the record, and `gabriel_test`, for the tests.**
Amended 26 September 2026. The live tests wrote invented rows into the record. `pnpm db:reset` now
drops and builds `gabriel_test` only, and `postgrest-test` serves it on `127.0.0.1:3001`. T2 still
holds: one datastore. A test run refuses any database but `gabriel_test`.

### 7. Secrets

`infra/.env.example` is committed and names every variable. `infra/.env` holds the values and is
ignored. **The example file holds a placeholder where the name is not a secret, and an empty value
everywhere else.** The first sentence of this section read "holds no value" and the file never
obeyed it: the database password and the keys of the raw store each carry a placeholder.

**The application signs with its own account, and never with root.** The admin pair serves the tests only.
`infra/seaweedfs/s3.json` gives the application account `s3:PutObject` and `s3:ListBucket` on
`raw`, and nothing more (ADR 0007 §2), so a fault in ingestion code cannot remove a source file
and cannot make the bucket public. **Amended 28 September 2026: `s3:ListBucket` was added for
the reconciliation run**, which compares the bucket's key list against the documents table and
cannot do that walk without listing. A read of one object is granted on the day a worker needs
one.

**Two limits, written down because they are easy to believe away.** Every entry point loads the
environment file whole, so the admin pair and the research pair sit in the same process as the
application pair: the account bounds the client, and it does not bound the process. And a put over a key that already
exists destroys the object it replaces, so the account cannot remove the evidence and it can still
overwrite it. T3 holds that second one: the raw file is unchanged by convention, and this runtime
enforces nothing. The bucket carries no versioning and no object lock, and neither is an oversight.

## Consequences

- **Docker Desktop must be running before anything works.**
- **The raw store is SeaweedFS, pinned by digest.** ADR 0007 holds the trigger that moves it.
- **The move to another database is portable in the container and not in the dependency.** Any
  future target must carry PostGIS and pgvector. SQLite and MySQL are excluded while T2 and T5
  stand.
