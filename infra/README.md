# infra

The services the project runs on the operator's machine. The decision and its reasons are in
[ADR 0002](../docs/adr/0002-local-runtime.md). Read that before you change anything here.

## First time

1. Start Docker Desktop. Nothing here works until its engine runs.
2. Copy `.env.example` to `.env` and put real values in it. `.env` is never committed.
3. Start the services:

```
docker compose -f infra/docker-compose.yml up -d
```


## Every day

| You want | Run |
|---|---|
| Start | `docker compose -f infra/docker-compose.yml up -d` |
| Stop, and keep the data | `docker compose -f infra/docker-compose.yml down` |
| See the logs | `docker compose -f infra/docker-compose.yml logs -f db` |
| Open the file browser | http://127.0.0.1:9001 |
| Open a SQL prompt | `docker compose -f infra/docker-compose.yml exec db psql -U gabriel -d gabriel` |

`down` keeps the data. It lives in the named volume `gab-db-data`.

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

Nothing is bound to a public address.

## Rules

- **Never use the `latest` tag.** Every tag here is pinned on purpose.
- **Never make the `raw` bucket anonymously readable.** T3 makes the file evidence, and
  ADR 0002 §3 states what publication does instead.
- The database schema does **not** live here. It lives in `db/`, and
  [ADR 0003](../docs/adr/0003-schema-pipeline-and-read-contract.md) governs it.
