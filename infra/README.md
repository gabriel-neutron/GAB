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

## The AIS collector

Digitraffic Marine keeps no archive, so a per-user Task Scheduler task pulls the AIS answers on a
fixed schedule, with no model, and stores each answer as a document in the record. A line for each
answer goes to a checkpoint file in a folder outside the repository. The task runs only while the
operator is signed in, so a time with the PC off is lost and it is a gap with no reason.

Run the task from a checkout that nothing changes, so a branch switch cannot stop it. The two paths
are absolute: the folder of the checkpoint, and the environment file of the research workspace.

| You want | Run, in that checkout |
|---|---|
| Add or change the task | `powershell -File tools/ais-collector-task.ps1 -Folder <folder> -EnvFile <file>` |
| Read the checkpoint of the last 48 hours | `node tools/ais-collector.ts report <folder> 48` |

## The setup check

The operator connects once and then does nothing, so a silent missing item would look like a dead
wave. A read-only check names each missing item of the person steps of the wave, and it changes no
setting. It prints only names and statuses, never a value, and it exits with 1 when an item is
missing. An item that only a person can do has the words "a person only". An unsigned list reports
`waiting_signature`, and a missing proxy key reports `not_set`: neither one is a fault.

| You want | Run |
|---|---|
| Read the setup | `node --env-file=<research environment file> tools/setup-check.ts <signed list file>` |

## The supervisor tick

The tenfold wave has no long-lived orchestrator, because a long-lived process can die and then a
person must restart it. A per-user Task Scheduler task starts one short tick at logon and each 5
minutes. The tick holds no model. It reads the ended workers, moves one ticket, starts one worker
up to the cap, writes the status file, and sends a Windows notification while an alarm is open. It
also starts one resume worker when the state file of the start session says "not closed" and has
no change for 30 minutes.

Only the tick writes state, and a state file stays read-only between ticks. Each change from
outside, such as an operator answer or a new ticket, is a request file in the inbox of the state
folder. The tick accepts it or refuses it. A worker gets no state: it prints a verdict, and the tick
reads it.

The state folder is outside the repository. It holds the settings file `supervisor.json`: the worker
`command`, `args` and `workDir`, the `cap`, and `waveStart` with `stateFile`, `prompt` and
`liveMatch`. Run the task from a checkout that nothing changes.

| You want | Run, in that checkout |
|---|---|
| Add or change the task | `powershell -File tools/supervisor-tick-task.ps1 -StateDir <folder>` |
| Run one tick now | `powershell -File tools/supervisor-tick.ps1 -StateDir <folder>` |

The host leases and the ceiling of the paid proxy are files in one folder (`packages/tools/src/host-lease.ts`). Set `GAB_STATE_DIR` to the state folder for the `gab` server and each worker, so each process reads the same state. The ledger stops each call to the proxy at the ceiling, and a stopped ticket gets a line in `blocked.md` in that folder. The proxy reads `BRIGHTDATA_API_KEY` and `BRIGHTDATA_ZONE`.

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
- `stack:up` also writes a new `GABRIEL_OPERATOR_KEY` in the block on each run, so a session stack
  never holds the key of the operator. To let a browser of the session write (Playwright, visual
  QA), open `http://localhost:5173/#operator-key=<the value of the block>` once.
- A second `stack:up` in the same worktree keeps the slot and the containers, and it builds
  `gabriel_test` again from zero.
- The stack holds the database, the read service of the test database and the raw store only.
  The worktree uses the SearXNG of the main stack, because SearXNG keeps no state.
- **The cap.** Two session stacks can run at the same time, because the VPS has 2 CPUs, 7.8 GB of
  RAM and no swap. A third `stack:up` stops, and it lists the stacks that run.
- **The cleanup.** `stack:down` stops each node process of the worktree (the writer, the worker,
  Vite, Vitest), but not its own shell and not a tool server that runs from outside the worktree.
  Then it removes the containers and the volumes. When a session ends (not on `/clear` or
  `/resume`), a hook of `.claude/settings.json` runs `stack:down`. A subagent gets no such event,
  so a subagent runs `stack:down` itself. `stack:up` first removes each session stack whose
  worktree under `.claude/worktrees/` is gone.

## Run a SQL script

```
pnpm db:sql "select count(*) from public.entities"
pnpm db:sql "select 1" gabriel
```

It runs the script in one `psql` session as the superuser `gabriel` (not `postgres`), on the stack
of the current checkout. The target is `gabriel_test`. The second argument `gabriel` names the
record, and only a session stack accepts it, because the record of the main stack is the published
one.

## Rules

- **Never use the `latest` tag.** Every tag here is pinned on purpose.
- **Never make the `raw` bucket anonymously readable.** T3 makes the file evidence, and
  ADR 0002 states what publication does instead.
- The database schema does **not** live here. It lives in `db/`, and
  [ADR 0003](../docs/adr/0003-schema-pipeline-and-read-contract.md) governs it.
