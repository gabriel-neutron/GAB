# ADR 0002 — Local runtime and data stores

**Status** Accepted · **Version** 1 · 7 August 2026
**Tickets** none open. This ADR closes a question that had no ticket, which was itself a fault.
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

- **Native Windows installs.** PostgreSQL and PostGIS both have installers. **pgvector does
  not.** It would have to be built with Visual Studio tools, or taken as a third-party binary
  matched to the exact PostgreSQL version. The state of the machine would live nowhere.
- **WSL2 with `apt`.** The extensions are packaged, but this adds a second file system and a
  second network for no gain over the option below.
- **Docker Compose.** One file. The extensions come from Debian packages inside the image.

## Decision

### 1. One Compose file, two services

`infra/docker-compose.yml` runs `db` and `minio`, plus a one-shot `minio-init`. Docker Desktop
is already installed on the machine and its window lists the containers, their logs and their
volumes, so it is also the graphical tool. **No second manager is added** — Portainer,
Coolify and the Supabase CLI each add a layer that must also be learned, and C4 rejects that.

### 2. The database image is built, not taken as-is

No published image carries both PostGIS and pgvector. The Dockerfile is three lines:

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

**One behaviour of the base image, recorded because it surprises.** `postgis/postgis` runs its
own initialisation script, which creates `postgis`, `postgis_topology`,
`postgis_tiger_geocoder` and `fuzzystrmatch` in the default database before any migration
runs. `vector` is **not** created; it is only installed. So the first migration must use
`CREATE EXTENSION IF NOT EXISTS` for both, and it must not assume an empty extension list.

### 3. One bucket, private

`raw` holds the original file exactly as it arrived. It is private. There is no anonymous
read.

A `derived` bucket was proposed and **rejected**: the extracted text already lives in
`doc_chunks`, so the bucket would hold a second copy of something the database owns. If a
document viewer later needs page images, such a bucket is disposable by definition and costs
nothing to add then.

The reason to keep it private is direct: an open bucket re-publishes every source file, much
of which carries someone else's copyright, and it makes a bandwidth target with no cache in
front of it.

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

- **Docker Desktop must be running before anything works.** That is the accepted cost, and it
  is one click.
- **MinIO is kept, with a caution recorded.** Its owner removed most of the community web
  console in 2025, the licence is AGPL, and the newest community release on 7 August 2026 is
  `RELEASE.2025-09-07` — eleven months old. Pinning the tag makes that staleness harmless
  today. If MinIO stops being viable, the replacement speaks the same S3 API: Garage or
  SeaweedFS. Nothing above the bucket changes.
- **The requirement "easy to move to another database later" is met in part only.** The
  container is portable. The dependency is not. T2 requires PostGIS, T5
  requires pgvector, and ADR 0003 puts views, functions and triggers in SQL. Any future target
  must carry both extensions. **SQLite and MySQL are excluded permanently.** A managed
  PostgreSQL that offers both is a connection-string change; one that does not is a rewrite.
  This cost is accepted, and it was accepted when T2 and T5 were accepted, not here.
- The three commands of ADR 0003 §4 assume these containers. The two ADRs are one runtime.

## Not decided here

- **PgBouncer and the CDN rules.** `spec.md` §4 names both as read-path guardrails. Neither
  belongs to a single operator's laptop, and both wait for a deployment that does not exist.
  ADR 0001 listed them under `infra/`; they stay absent.
- **Anything about deployment.** This ADR describes the operator's machine only.
