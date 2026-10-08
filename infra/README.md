# infra

The services the project runs on the operator's machine. The decision and its reasons are in
[ADR 0002](../docs/adr/0002-local-runtime.md). Read that before you change anything here.

## First time

1. Start Docker Desktop. Nothing here works until its engine runs.
2. Copy `.env.example` to `.env` and put real values in it. `.env` is never committed. The
   `RAW_STORE_*_KEY` values are necessary: `docker compose` and `pnpm db:reset` stop without them.
   Use only letters, digits, `.`, `_`, `+` and `-` in each key.
3. Start the services:

```
docker compose -f infra/docker-compose.yml up -d
```

## The raw store

SeaweedFS keeps each source file exactly as it arrived, in the private bucket `raw`. It starts
with the other services, and it makes the bucket at start. The accounts and their rights
are in `seaweedfs/s3.json`, and the keys come from `.env`:

- `RAW_STORE_ACCESS_KEY` and `RAW_STORE_SECRET_KEY`: the application. It may put an object in
  `raw` and list `raw`. It may not read, delete or change the bucket.
- `RAW_STORE_ADMIN_ACCESS_KEY` and `RAW_STORE_ADMIN_SECRET_KEY`: the tests. They may read, write
  and list `raw`.
- `RAW_STORE_RESEARCH_ACCESS_KEY` and `RAW_STORE_RESEARCH_SECRET_KEY`: the research workspace. It
  may put an object in `raw`, and nothing else. `research/.env` takes these two values as
  `RAW_STORE_ACCESS_KEY` and `RAW_STORE_SECRET_KEY`.
- `RAW_STORE_READ_ACCESS_KEY` and `RAW_STORE_READ_SECRET_KEY`: the writer, to show a stored image
  on the review page. It may read an object in `raw`, and nothing else.

A caller with no key gets 403. The store keeps its bytes in the named volume `gab-raw-data`.
Any other S3 provider can hold the bucket: set `RAW_STORE_ENDPOINT` and `RAW_STORE_REGION`.

## The search service

SearXNG starts with the other services. It holds no record of the project.

1. `SEARXNG_SECRET` can stay empty: the compose file then uses a fixed value that fits a loopback
   port.
2. Start it: `docker compose -f infra/docker-compose.yml up -d --wait searxng`.
3. Check it: `curl 'http://127.0.0.1:8888/search?q=test&format=json'` answers JSON.

The VPS runs the same service on the Tailscale address. See `vps/README.md`.

## The model service

Every model call goes to OpenRouter. No local service runs it. Put `OPENROUTER_API_KEY` in `.env`.
The key is a paid key. Set a credit limit on it in the OpenRouter dashboard.

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
| `127.0.0.1:8888` | SearXNG, the engine of `web_search` (`/search?q=test&format=json`) |

Nothing is bound to a public address. Each published port comes from a `GAB_*_PORT` variable in
`.env`, and an absent variable gives the port in this table.

## The stack of a session

Many sessions can run on one machine at the same time. When they share one stack, a reset in one
session deletes the test data of another. So a session that works in a git worktree starts its own
stack, and the main checkout keeps the shared `gab` stack.

| You want | Run, in the worktree |
|---|---|
| Start the stack of this worktree, and build `gabriel_test` in it | `pnpm stack:up` |
| Stop it and delete its data | `pnpm stack:down` |

- `stack:up` refuses in the main checkout. It copies `.env` from the main checkout when the
  worktree has none. Then it writes one marked block at the end of `.env`: the compose project,
  the ports of a free slot, and the addresses that the tools and the tests read. Each run replaces
  the block.
- The stack holds the database, the read service of the test database and the raw store only.
  The worktree uses the SearXNG of the main stack, because SearXNG keeps no state.
- **The cap.** Two session stacks can run at the same time, because the VPS has 2 CPUs, 7.8 GB of
  RAM and no swap. A third `stack:up` stops, and it lists the stacks that run.
- **The cleanup.** `stack:down` stops each node process of the worktree (the writer, the worker,
  Vite, Vitest), but not its own shell. Then it removes the containers and the volumes. When a
  session ends, a hook of `.claude/settings.json` runs `stack:down`. `stack:up` first removes each
  session stack whose worktree is gone.

## Run one SQL statement

```
pnpm db:sql "select count(*) from public.entities"
pnpm db:sql "select 1" gabriel
```

It logs in as the superuser `gabriel` (not `postgres`) on the stack of the current checkout, on
`gabriel_test` unless the second argument names `gabriel`.

## Rules

- **Never use the `latest` tag.** Every tag here is pinned on purpose.
- **Never make the `raw` bucket anonymously readable.** T3 makes the file evidence, and
  ADR 0002 states what publication does instead.
- The database schema does **not** live here. It lives in `db/`, and
  [ADR 0003](../docs/adr/0003-schema-pipeline-and-read-contract.md) governs it.
