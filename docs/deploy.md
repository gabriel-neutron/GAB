# Deploy

The public deployment is read-only. The deployment target is open. The writer and the worker jobs
stay on the operator's machine.

## The database and the raw store

1. In `infra/.env`, set `GABRIEL_DB_HOST`, `GABRIEL_DB_PORT` and `GABRIEL_DB_SSL=true` to the
   connection of the database.
2. Run `pnpm db:migrate`, then `pnpm db:apply`.
3. Any S3 provider can hold the raw store. Set `RAW_STORE_ENDPOINT` to its S3 endpoint and
   `RAW_STORE_REGION` to its region.

The read API serves the `api` schema as `gabriel_read`. It writes nothing.

## Vercel

1. Deploy the repository root.
2. Set `VITE_API_URL` to the URL of the read API.

`vercel.json` sends every path to the application, except `/assets/` and `/write`. A request to
`/write` gets a 404.

## The writer and the worker

Run `pnpm writer` and the worker on the operator's machine, with the same `infra/.env` as above.
The worker is one command with four sub-commands: `pnpm worker run` takes the queued AI jobs,
`pnpm worker ingest` stores files, `pnpm worker layout` computes the graph layout, and
`pnpm worker reconcile` compares the raw store with the document index. They run as they do
against the local stack. Only the values change. Run one `pnpm worker run` at a time: at its
start, it puts back each job that is still running. `pnpm worker ingest` stores a file only with
`--uri`, the address where the file comes from (`decisions.md` PU1), so give one file for each run.
For a bought file, also give `--cost-eur`, or `--provider` with a provider that sells its filings,
so that the file stays not public.

`pnpm worker run` needs OpenRouter and two models. Set `OPENROUTER_API_KEY`, the `EXTRACTOR_`
values and the `CHECKER_` values, as `infra/.env.example` lists them. `EXTRACTOR_FAMILY` and
`CHECKER_FAMILY` must name two different model families. When an `EXTRACTOR_` or a `CHECKER_`
value is absent or wrong, or the two families are the same, the worker starts and writes one line
that says "the extractor is not set up" with the name of the value. Each extraction job then fails
with that reason, and the other agents run. The mapper, the rater and the lead agent do the same
with their values.

The MCP server of the research session asks the same checker for each batch that the research AI
proposes. The server reads these values from `infra/.env`, from any start folder:
`OPENROUTER_API_KEY`, the `CHECKER_` values, `RESEARCH_CHECK_TOKEN_CAP` and
`GABRIEL_CHECKER_PASSWORD`. `RESEARCH_CHECK_TOKEN_CAP` is a hard cap on the tokens of one check.
The checker gets one call, with no retry. On the Windows PC, add `GABRIEL_CHECKER_PASSWORD` and
`RESEARCH_CHECK_TOKEN_CAP` to `infra/.env`. Then run `pnpm db:migrate`. It creates the checker
role and sets its password. Never put that password in `research/.env`: the research AI reads that
file. The server knows the family of the research AI from the name of its MCP client:
`claude-code` is `anthropic`, and a name with `codex` is `openai`. A client that runs a model of
another provider under one of these names gives a wrong family. Set a `CHECKER_FAMILY` that is
neither. When a value is absent, the server starts. Each proposal then waits with no check, and
the answer of the tool names the value. Propose the same batch again when the checker is up: the
server checks it then.

Cost control has two limits. Each job has a token cap. The key has a credit limit that you set in
the OpenRouter dashboard. OpenRouter routes each call with `data_collection` set to `deny`, so a
provider must not keep the prompts or train on them. When the credit is spent, each job fails with
a clear reason. Add credit, and queue the jobs again.

The lead agent of `pnpm worker run` asks the extractor model. Set `LEAD_TOKEN_CAP`, the token
budget of one lead, and `SEARXNG_URL`, the address of the search service. The worker stores each
page that a lead fetches, so it also needs the raw store values. When one of these values is
absent, the worker starts and runs the extractions, and each lead fails at once with a reason that
names the value.

A rule starts a deepening search for a unit with weak sources only when the deepening budget is
above zero. The budget is a setting of the database, not of `infra/.env`, and it starts at zero.
To set the tokens of one search, run this statement as the superuser `gabriel` on the record.
On the local stack, type this in PowerShell at the root of the GAB checkout, on one line:

```powershell
docker compose -f infra/docker-compose.yml exec db psql -U gabriel -d gabriel -c "UPDATE rule_config SET version = version + 1, settings = jsonb_build_object('deepening_tokens', 40000) WHERE rule = 'weak_sources';"
```

On a hosted database, run the same statement with `psql` and the connection of step 1 above.

A change from zero sends each waiting unit through the rules again. Set `0` to stop new searches.

The mapper of `pnpm worker run` maps the columns of a stored CSV table. Set the `MAPPER_*` values
that `infra/.env.example` lists. When one of them is absent, the worker starts and runs the
extractions, and each mapping fails at once with a reason that names the value. The load of a
promoted mapping runs with no model and needs the raw store values.

The rater of `pnpm worker run` rates each new author name. Set the `RATER_*` values that
`infra/.env.example` lists, with the strongest model that OpenRouter gives. When one of them is
absent, the worker starts and runs the extractions, and each rating fails with a reason that names
the value. A rating waits in the queue until the operator approves the reference set:

1. Store the set. It is not used yet. Use one of two ways:
   - `pnpm worker reference-set load <file>` stores a set that experts wrote. The file is JSON
     with an `authors` list. It needs no model and no OpenRouter key. The repository holds the
     first set in `packages/worker/src/rater/reference-set.json`. Experts wrote it, and the
     operator approved it.
   - `pnpm worker reference-set build` asks the model once for about thirty authors, each with a
     letter and a reason, and stores them.
2. `pnpm worker reference-set show` prints the set. Read each letter and each reason.
3. `pnpm worker reference-set approve` makes the set usable. From then on each new author name
   gets a rating job by itself.

`BRAVE_SEARCH_API_KEY` is optional, and SearXNG alone is enough. Brave Search is a service
that can cost money. The search asks Brave only when you set a key, and only when SearXNG fails or
gives no result. A lead runs only when the operator or the research AI starts it: no schedule
starts one.

## Public writes

No public write path exists. A public write needs real authentication first, and that is separate
work.
