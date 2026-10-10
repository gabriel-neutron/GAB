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
The worker is one command with sub-commands: `pnpm worker run` takes the queued AI jobs,
`pnpm worker ingest` stores files, `pnpm worker layout` computes the graph layout,
`pnpm worker reconcile` compares the raw store with the document index, `pnpm worker
reference-set` manages the reference set of the authors, `pnpm worker author-names` decides the
names that joined an author A or B, `pnpm worker requeue-ratings` tries the ratings that failed
by a fault again, `pnpm worker reread-html` reads the stored HTML pages again, and
`pnpm worker release` writes a release and `pnpm worker nato-coverage` reports the share of
claims with a NATO pair (see below). They run as they do against the local stack.
Only the values change. Run one `pnpm worker run` at a time: at its start, it puts back each job
that is still running. `pnpm worker ingest` stores a file only with
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

A rating that failed leaves its name F. `pnpm worker requeue-ratings` puts each rating job that
failed by a fault back in the queue with no attempt, and prints each name with the reason of the
earlier attempt: the job keeps no record of it. The next `pnpm worker run` rates them, and each
job costs one call to the model. A rating that the model refused stays failed: the command does
not put it back. A refusal is asked again only after you refuse a joined name.

### Decide the names that joined an author A or B

The rater can join a new name to a known author. A join into an author A or B raises the letter of
each act of that name, so the name reads as F and its units are a doubt until you decide it:

1. `pnpm worker author-names list` prints each name that waits, with its author, the letter and
   the number of its units.
2. `pnpm worker author-names dry-run` prints, for each name, how many units would change state if
   you confirm it and if you refuse it. It writes nothing.
3. `pnpm worker author-names confirm <name>` gives the name the letter of its author.
   `pnpm worker author-names refuse <name>` makes the name F, and the rater rates it again as a
   new author. The rules then read the units of the name again. A decision is final.

The review page shows the same list on its Names page, with the same two actions.

`BRAVE_SEARCH_API_KEY` is optional, and SearXNG alone is enough. Brave Search is a service
that can cost money. The search asks Brave only when you set a key, and only when SearXNG fails or
gives no result. A lead runs only when the operator or the research AI starts it: no schedule
starts one.

### Read the stored HTML pages again

Before PR #416, the fetch tool read each HTML page as UTF-8. A page in windows-1251 or koi8-r got a
garbled text and a garbled title. Its bytes in the raw store are correct. Run this once on the
local record, before the vector index is built:

1. `pnpm worker reread-html --dry-run` prints each document whose text or title would change, and
   writes nothing.
2. `pnpm worker reread-html` writes the changes.

The command reads each stored HTML or XHTML document (also a saved HTML file) from the raw store,
with the read key `RAW_STORE_READ_ACCESS_KEY`. It reads a render of the browser, and each page whose
bytes are valid UTF-8, as UTF-8. When the text changes, it writes the text as a new text set, and
each reader then reads that set. The old set stays, so each citation stays valid. When the corrected
text does not hold the excerpt of a citation of a document, the command keeps the text and the title
of that document as they are. The report and the dry run list each such document with these
citations: read them. A render of a kept page keeps its title too. The title changes only when the
document still holds the title that the old reading gave. The command does not change the bytes, the
id, the address or the date of a document. A second run changes nothing. It gives exit code 1 when a
document could not be read, with the reason. A page whose charset was only in the header of the
answer, and not in the page, stays as it is, because the record keeps the type without its charset.

### Write a release

A release is one folder of files that you can publish. Write the release manifest first, outside
the GAB checkout, because it holds your contact addresses. It is a JSON file:

```json
{
  "version": "1.0",
  "date": "2026-11-08",
  "contacts": {
    "reportError": "https://example.org/report-an-error",
    "rightOfReply": "mailto:reply@example.org"
  }
}
```

Only `contacts` is necessary. Each address starts with `https://` or `mailto:`. With no `date`,
the release takes the date of the day (UTC). With no `version`, the version is the date.
`showNatoPair` is `false` by default, and the public does not see the pair (`decisions.md` S1).
Set it to `true` only after a change of S1: then each claim row of `claims.csv` and
`dataset.jsonld` gives its NATO letter and digit, and `manifest.json` says that the pair is shown.
`iriBase` is the base of the identifiers of the JSON-LD file: an `https://` address that ends with
a slash. Set it once, to the address of the public site, before the first public release, and
never change it after, because reusers link to these identifiers.
The command also refuses a key that it does not know, and a quote, a comma or a control
character in the version or an address.

`criticalNodes` is the path of your sheet of candidate nodes, relative to the folder of the
manifest. Keep the sheet outside the GAB checkout too. It is a CSV file with these five columns,
in any order:

- `node_id`: the entity identifier of the node.
- `condition`: `b` (documented production or throughput in 2024-2026), `c` (presence in a bypass
  routing across jurisdictions), or nothing for a row that only names the node and its texts.
- `claim_ids`: the claim identifiers that support the tick, as `claims.csv` gives them, separated
  by spaces. Nothing gives a tick that shows "not sourced".
- `controller`: a short text, who controls the node.
- `bypass_pattern`: a short text, the bypass pattern.

Give one row for each node and condition. Give the texts of a node on one of its rows, or the same
texts on each row. The two texts are public: do not name a person that the release does not show.
Save the sheet as CSV UTF-8, with commas. A line that starts with `#` is a note. You do not tick
condition (a): the release ticks it from the public designations of the node itself, ended or not. A
node with two ticks or more is retained. The release refuses the sheet, and writes nothing, when a
row names a node or a claim that is not public in the release. The message gives the line. With no
`criticalNodes`, the table has no row.

Then run, on the record:

```powershell
pnpm worker release --manifest <the manifest file> --out <a folder> --previous <the previous release folder>
```

Give `--previous` the folder of the last release that you published, as you published it. For
the first release, do not give it.

The command writes the folder `gab-release-<date>` in the `--out` folder. It refuses to write
over a folder of the same date. Each CSV file starts with lines that start with `#`: the version,
the date and the disclaimer. A spreadsheet shows them as rows. A program that reads the file must
skip them. `entities.geojson` opens in QGIS as a layer of the entities with a position.
`dataset.jsonld` holds the entities, the relations and the claims as linked data, with the
definition of each term. `critical-nodes.csv` is the critical nodes table, with the three conditions,
the claims of each tick and the retained nodes first. `changelog.csv` is the changelog since the
previous release: one row for each entity, relation and claim added, changed or removed, with the
changed columns, and each entity merged into a survivor or unmerged. Without `--previous`, it
says "First release" and has no row. The command refuses a previous folder whose files do not
agree with its `manifest.json`, or that is not earlier, and writes nothing. `manifest.json` gives
the size and the SHA-256 checksum of each file, and a summary of the changelog.

To see the share of the public claims that have a full NATO pair (a letter and a digit) before
you decide S1, run on the record:

```powershell
pnpm worker nato-coverage
```

It prints one line for all the claims of a release, then one line for each entity type and each
relation type: the claims with a full pair, all the claims, and the share. It writes nothing.

## Public writes

No public write path exists. A public write needs real authentication first, and that is separate
work.
