# ADR 0002 — Local runtime and data stores

**Status** Accepted · 7 August 2026

T2 makes PostgreSQL/PostGIS the single GOLD datastore, T5 puts pgvector in that same database, and
T3 puts the immutable raw file in an S3 store. So the first build runs two services. Development
happens on **Windows only**, for one operator who is not a Docker expert.

### 1. One Compose file, two services

`infra/docker-compose.yml` runs `db` and `minio`, plus a one-shot `minio-init`. Docker Desktop is
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
already created and pgvector is installed but not created. **The first migration must use
`CREATE EXTENSION IF NOT EXISTS` for both, and must not assume an empty extension list.**

### 3. One bucket, private

`raw` holds the original file exactly as it arrived. It is private, and there is no anonymous read.
An open bucket re-publishes every source file, and a collected corpus holds files that someone else
owns the rights to.

**A reader is given the original source URL, a public web-archive URL and the file hash**, all
recorded at ingest. PU1 governs the claims and their citations, not the bytes.

### 4. Ports on the loopback address only

`127.0.0.1:5432` for the database, `127.0.0.1:9000` for the S3 API, `127.0.0.1:9001` for the MinIO
console. Nothing is bound to a public address. The console stays enabled.

### 5. Every image tag is pinned

Never `latest`. An upstream change must arrive through a commit, never through a restart.

### 6. Named volumes, and one reset command

`gab-db-data` and `gab-minio-data`. Data survives `docker compose down`, and is destroyed by
`docker compose down -v` and by nothing else.

### 7. Secrets

`infra/.env.example` is committed and names every variable. `infra/.env` holds the values and is
ignored. **The example file holds a placeholder where the name is not a secret, and an empty value
everywhere else.** The first sentence of this section read "holds no value" and the file never
obeyed it: the database password, the MinIO user and the MinIO password each carry a placeholder.

**The application signs with its own account, and never with root.** The root pair makes the bucket
and makes that account, and nothing else uses it. `minio-init` grants that account `s3:PutObject` on
`raw` and nothing more, so a fault in ingestion code cannot remove a source file, cannot list the
bucket, and cannot make the bucket public. A read is granted on the day a worker needs one.

**Two limits, written down because they are easy to believe away.** Every entry point loads the
environment file whole, so the root pair sits in the same process as the application pair: the
account bounds the client, and it does not bound the process. And a put over a key that already
exists destroys the object it replaces, so the account cannot remove the evidence and it can still
overwrite it. T3 holds that second one: the raw file is unchanged by convention, and this runtime
enforces nothing. The bucket carries no versioning and no object lock, and neither is an oversight.

## Consequences

- **Docker Desktop must be running before anything works.**
- **MinIO is kept, and its upstream is archived.** No further release is expected, security fixes
  included. The risk is recorded, not dismissed, and the tracker carries it.
- **The move to another database is portable in the container and not in the dependency.** Any
  future target must carry PostGIS and pgvector. SQLite and MySQL are excluded while T2 and T5
  stand.
