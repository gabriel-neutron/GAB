# infra

The services the project runs on the operator's machine. The decision and its reasons are in
[ADR 0002](../docs/adr/0002-local-runtime.md). Read that before you change anything here.

## First time

1. Start Docker Desktop. Nothing here works until its engine runs.
2. Copy `.env.example` to `.env` and put real values in it. `.env` is never committed. The four
   `RAW_STORE_*_KEY` values are necessary: `docker compose` and `pnpm db:reset` stop without them.
   Use only letters, digits, `.`, `_`, `+` and `-` in each key.
3. Start the services:

```
docker compose -f infra/docker-compose.yml up -d
```

## The raw store

SeaweedFS keeps each source file exactly as it arrived, in the private bucket `raw`. It starts
with the other services, and it makes the bucket at start. The three accounts and their rights
are in `seaweedfs/s3.json`, and the keys come from `.env`:

- `RAW_STORE_ACCESS_KEY` and `RAW_STORE_SECRET_KEY`: the application. It may put an object in
  `raw` and list `raw`. It may not read, delete or change the bucket.
- `RAW_STORE_ADMIN_ACCESS_KEY` and `RAW_STORE_ADMIN_SECRET_KEY`: the tests. They may read, write
  and list `raw`.
- `RAW_STORE_RESEARCH_ACCESS_KEY` and `RAW_STORE_RESEARCH_SECRET_KEY`: the research workspace. It
  may put an object in `raw`, and nothing else. `research/.env` takes these two values as
  `RAW_STORE_ACCESS_KEY` and `RAW_STORE_SECRET_KEY`.

A caller with no key gets 403. The store keeps its bytes in the named volume `gab-raw-data`.
Any other S3 provider can hold the bucket: set `RAW_STORE_ENDPOINT` and `RAW_STORE_REGION`.

## The model gateway and the search service

freellmapi and SearXNG start with the other services. They hold no record of the project.

1. Put a value in `FREELLMAPI_ENCRYPTION_KEY` in `.env`: `openssl rand -hex 32`. freellmapi does
   not start without it. `SEARXNG_SECRET` can stay empty: the compose file then uses a fixed value
   that fits a loopback port.
2. Start them: `docker compose -f infra/docker-compose.yml up -d --wait freellmapi searxng`.
3. **Provider keys do not go in `.env`.** Open http://127.0.0.1:4001, enter each provider key on
   the **Keys** page, and copy the unified key of freellmapi. freellmapi keeps the provider keys,
   encrypted, in the volume `freellmapi-data`. If you lose `FREELLMAPI_ENCRYPTION_KEY`, you must
   enter every provider key again. `down -v` deletes the volume and the keys.
4. Check the search service: `curl 'http://127.0.0.1:8888/search?q=test&format=json'` answers JSON.

The VPS runs the same two services on the Tailscale address. See `vps/README.md`.

## Every day

| You want | Run |
|---|---|
| Start | `docker compose -f infra/docker-compose.yml up -d` |
| Stop, and keep the data | `docker compose -f infra/docker-compose.yml down` |
| See the logs | `docker compose -f infra/docker-compose.yml logs -f db` |
| Open a SQL prompt | `docker compose -f infra/docker-compose.yml exec db psql -U gabriel -d gabriel` |

`down` keeps the data. It lives in the named volumes `gab-db-data` and `gab-raw-data`.

## Destroy the data

```
docker compose -f infra/docker-compose.yml down -v
```

`-v` removes the volumes. There is no undo. `pnpm db:reset` does not call it: it builds only the
test database, `gabriel_test`, again.

## What is where

| Address | Service |
|---|---|
| `127.0.0.1:5432` | PostgreSQL 17, with PostGIS and pgvector |
| `127.0.0.1:3000` | The PostgREST read API, over the `api` schema |
| `127.0.0.1:3001` | The same read API over `gabriel_test`, for the tests |
| `127.0.0.1:9000` | SeaweedFS, the S3 API of the raw store (bucket `raw`) |
| `127.0.0.1:4001` | freellmapi, the model gateway of the back-end AI (`/v1`, and a dashboard) |
| `127.0.0.1:8888` | SearXNG, the engine of `web_search` (`/search?q=test&format=json`) |

Nothing is bound to a public address.

## Rules

- **Never use the `latest` tag.** Every tag here is pinned on purpose.
- **Never make the `raw` bucket anonymously readable.** T3 makes the file evidence, and
  ADR 0002 §3 states what publication does instead.
- The database schema does **not** live here. It lives in `db/`, and
  [ADR 0003](../docs/adr/0003-schema-pipeline-and-read-contract.md) governs it.
