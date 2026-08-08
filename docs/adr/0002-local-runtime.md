# ADR 0002 — Local runtime and data stores

**Status** Accepted · **Version** 1 · 7 August 2026
**Tickets** #31 how a reader reaches a source file, #32 MinIO upstream is archived. This ADR
closes a question that had no ticket, which was itself a fault.
**Resolves** the `infra/` row of the "Deliberately absent" table in ADR 0001. That row held the
folder back because no document said how PostgreSQL runs locally, and no ticket carried the
question. This ADR answers it, and the Status column of that row now reads **Created**. The
rest of ADR 0001 stays true and stays Accepted.

## Context

T2 makes PostgreSQL/PostGIS the single GOLD datastore. T5 puts pgvector in that same database
and replaces NATS with a job table. T3 puts the immutable raw file in an S3 store, and names
MinIO. So the first build runs two services.

No document said how those two services run on the operator's machine, and no ticket carried
the question. Development happens on **Windows only**. The operator is one analyst who is
also the only developer, and is not a Docker expert nor a deployment expert. The stated
requirement was a solution that is easy to start and easy to move later.

Three options were weighed:

- **Native Windows installs.** PostgreSQL and PostGIS both have installers. pgvector is
  believed to have none, so it would have to be built or taken as a third-party binary matched
  to the exact PostgreSQL version. **That belief was not tested**, because the option below was
  proven first. The decisive objection does not depend on it: the state of the machine would
  live in no file, so a second machine could not be brought to the same state.
- **WSL2 with `apt`.** The extensions are packaged there. It adds a second file system and a
  second network, and it still records the state of the machine in no file.
- **Docker Compose.** One file. The extensions come from Debian packages inside the image.

## Decision

### 1. One Compose file, two services

`infra/docker-compose.yml` runs `db` and `minio`, plus a one-shot `minio-init`. Docker Desktop
is already installed on the machine and its window lists the containers, their logs and their
volumes, so it is also the graphical tool. **No second manager is added** — Portainer,
Coolify and the Supabase CLI each add a layer that must also be learned, and C4 rejects that.

### 2. The database image is built, not taken as-is

The two obvious images each carry one extension and not the other: `postgis/postgis` has no
pgvector, and `pgvector/pgvector` has no PostGIS. **No wider survey of published images was
made**, so an image that carries both may exist. The Dockerfile is three lines, so the search
was not worth making:

```dockerfile
FROM postgis/postgis:17-3.5
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-17-pgvector \
 && rm -rf /var/lib/apt/lists/*
```

**This is proven, not assumed.** Built and run on 7 August 2026:

| Component | Version |
|---|---|
| PostgreSQL | 17.5 |
| PostGIS | 3.5.2 |
| pgvector | 0.8.6 |

A table holding `geometry(Point,4326)` and `vector(3)` was created, written and read back, and
the pgvector distance operator returned a correct result.

**One behaviour of the base image, recorded because it surprises.** On a fresh volume,
`CREATE EXTENSION postgis` reported that the extension already existed, and `CREATE EXTENSION
vector` created it. So `postgis/postgis` creates PostGIS in the default database before any
migration runs, and pgvector is installed but not created. A first run also listed
`postgis_topology`, `postgis_tiger_geocoder` and `fuzzystrmatch` as present.

The first migration must therefore use `CREATE EXTENSION IF NOT EXISTS` for both, and it must
not assume an empty extension list.

### 3. One bucket, private

`raw` holds the original file exactly as it arrived. It is private. There is no anonymous
read.

A `derived` bucket was proposed and **rejected**. `spec.md` §1 puts the extracted text in
chunks inside the database, so the bucket would hold a second copy of something the database
owns. **No schema is decided, so this rests on the intended shape and not on a built table.**
If a document viewer later needs page images, a bucket for them holds only rebuildable files,
so it can be added at that point.

The reason to keep the bucket private is direct: an open bucket re-publishes every source
file, and a collected corpus is likely to hold files that someone else owns the rights to. It
also makes a bandwidth target with no cache in front of it.

**How a reader reaches a source file is not decided here, and this ADR does not decide it.**
PU1 says the entire system is publishable. Whether that requires the raw store to be
readable from outside is an open question, and a signed-URL route would be a read served by
the Node backend, which presses on T4. Neither PU1 nor T4 is replaced by this ADR. See **#31**.
Until it closes, the bucket is private and no external read path exists.

### 4. Ports on the loopback address only

`127.0.0.1:5432` for the database, `127.0.0.1:9000` for the S3 API, `127.0.0.1:9001` for the
MinIO console. Nothing is bound to a public address.

The console stays enabled. It lets the operator see the files in a browser, without a command
and without a client.

### 5. Every image tag is pinned

`postgis/postgis:17-3.5`, `minio/minio:RELEASE.2025-09-07T16-13-09Z`,
`minio/mc:RELEASE.2025-08-13T08-35-41Z`. Never `latest`. An upstream change must arrive
through a commit, never through a restart.

### 6. Named volumes, and one reset command

`gab-db-data` and `gab-minio-data`. Data survives `docker compose down`. It is destroyed by
`docker compose down -v`, and by nothing else. `pnpm db:reset`, when ADR 0003 §4 adds it, is
a name for that command.

### 7. Secrets

`infra/.env.example` is committed and holds no value. `infra/.env` holds the values and is
already excluded by `.gitignore`.

## Consequences

- **Docker Desktop must be running before anything works.** That is the accepted cost. It is
  started from the Start menu, and its engine takes a moment to come up after that.
- **MinIO is kept, and its upstream is dead.** Checked on 7 August 2026 through the GitHub
  API: `minio/minio` and `minio/mc` are both **archived**, and both are AGPL-3.0. The newest
  tag on Docker Hub for `minio/minio` is `RELEASE.2025-09-07T16-13-09Z`, and a later GitHub
  release, `RELEASE.2025-10-15`, was never published to Docker Hub. So the pinned tag is the
  newest image available, and **no further release is expected, security fixes included**.
  MinIO still does the job asked of it — a simple local S3 for one operator — and it is kept
  for that. The risk is recorded, not dismissed. **#32** carries it. Garage and SeaweedFS
  speak the S3 API and are the obvious candidates, but **neither was evaluated**.
- **The requirement "easy to move to another database later" is met in part only.** The
  container is portable. The dependency is not. T2 requires PostGIS, T5
  requires pgvector, and ADR 0003 puts views, functions and triggers in SQL. Any future target
  must carry both extensions. **SQLite and MySQL are excluded while T2 and T5 stand.** A
  managed PostgreSQL that offers both should be a connection-string change; one that does not
  is a rewrite. **No managed host was checked for either extension.** This cost is accepted,
  and it was accepted when T2 and T5 were accepted, not here.
- The three commands of ADR 0003 §4 assume these containers. The two ADRs are one runtime.

## Not decided here

- **PgBouncer and the CDN rules.** `spec.md` §4 names both as read-path guardrails. Neither
  belongs to a single operator's laptop, and both wait for a deployment that does not exist.
  ADR 0001 listed them under `infra/`; they stay absent.
- **Anything about deployment.** This ADR describes the operator's machine only.
