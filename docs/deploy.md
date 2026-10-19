# Deploy

The public surface is the site of a release: plain files, no API, no server (ADR 0028). The site is
the application, built with the files of the release. The database, the read API, the writer and
the worker stay on the operator's machine. To publish, write a release (below) and put its site on
any static host.

Every worker command is a sub-command of `pnpm worker`. Run it with no argument for the list and
the usage. Run a command with `--dry-run` first when it has that flag. Every value below is
listed, with its comment, in `infra/.env.example`, except `FIRMS_MAP_KEY` (set it in the environment).

## The database and the raw store

1. In `infra/.env`, set `GABRIEL_DB_HOST`, `GABRIEL_DB_PORT` and `GABRIEL_DB_SSL=true`.
2. Run `pnpm db:migrate`, then `pnpm db:apply`.
3. Any S3 provider holds the raw store: set `RAW_STORE_ENDPOINT` and `RAW_STORE_REGION`.

## The writer and the worker

Run `pnpm writer` and the worker on the operator's machine with the same `infra/.env`.

- **Operator key:** `pnpm writer` does not start without `GABRIEL_OPERATOR_KEY` (at least 32
  characters of A-Z, a-z, 0-9, `-`, `_`). Make one with
  `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. If a write
  answers that the request has no key, start `pnpm dev` again.
- **One runner:** run one `pnpm worker run` at a time. At its start it puts back each running job.
  After a lost database connection it waits, retries and requeues the job in hand.
- **Ingest:** `pnpm worker ingest` needs `--uri`, the address where the file comes from (PU1), one
  file for each run. For a bought file, also give `--cost-eur`, or `--provider` of a provider that
  sells its filings, so the file stays not public.

### Models

`pnpm worker run` calls OpenRouter. Each agent (extractor, checker, mapper, rater, lead) reads its
own group of values. When a value is absent or wrong, the worker still starts, and each job of that
agent fails with a reason that names the value.

- `EXTRACTOR_FAMILY` and `CHECKER_FAMILY` must name two different model families.
- The MCP server asks the same checker for each batch of the research AI. It reads the checker
  values, `RESEARCH_CHECK_TOKEN_CAP` and `GABRIEL_CHECKER_PASSWORD` from `infra/.env`. After you
  set the password, run `pnpm db:migrate`: it creates the checker role. Never put that password in
  `research/.env`, which the research AI reads. With a value absent, a proposal waits with no check;
  propose the batch again when the checker is up.
- The server guesses the family of the research AI from the name of its MCP client. A client that
  runs a model of another provider gives a wrong family: set a `CHECKER_FAMILY` that is neither.
- **Cost:** each job has a token cap, and the key has a credit limit that you set in the OpenRouter
  dashboard. Calls go with `data_collection` set to `deny`. When the credit is spent, each job fails
  with a clear reason: add credit and queue the jobs again.
- **Leads:** set `LEAD_TOKEN_CAP` and `SEARXNG_URL`. `BRAVE_SEARCH_API_KEY` is optional and can cost
  money: it is asked only when SearXNG fails.
- **Deepening search:** the budget is a setting of the database, not of `infra/.env`, and it starts
  at zero. Set it in `rule_config` for the rule `weak_sources` (key `deepening_tokens`), as the
  superuser, and raise `version` by one. A change from zero sends each waiting unit through the
  rules again. Zero stops new searches.

### Mappings

Before you promote a mapping, run `pnpm worker dry-join <mapping> > join.csv`. It writes, for each
row, the key that finds its entity or creates one, calls no model and writes nothing. A row that
finds its entity by name only becomes a doubt: add an identifier to the record first.

### The reference set of the authors

The rater waits until the operator approves a reference set.

1. Store the set: `reference-set load <file>` (a JSON file from experts; the repository holds the
   first set, approved by the operator) or `reference-set build` (the model gives about thirty
   authors).
2. `reference-set show`: read each letter, reason and site. A source A counts alone only on a site
   of its author. A set stored before the sites needs `reference-set sites <file>` once.
3. `reference-set approve`: from then on each new author name gets a rating job.

To add authors, edit the file, run `reference-set add <file> --dry-run`, then without the flag,
`show` and `approve`. A name the worker already rated is refused: give the new author another name.
`requeue-ratings` retries the ratings that failed by a fault; a refused rating is not retried.

When the rater joins a new name to an author A or B, the name reads as F and its units are a doubt
until you decide it with `author-names` (`list`, `dry-run`, `confirm`, `refuse`, `move`, `rerate`;
each decision is final). The Names page of the review page does the same.

### Other commands

- `reread-html`: rereads stored HTML pages. Run it with `--dry-run` first. It keeps the old text set
  so each citation stays valid.
- `name-candidates`: finds merge candidates across a Latin and a Cyrillic spelling. Run it before a
  release, then decide each pair in the "Two scripts" tab.
- `nato-coverage`, `asset-coverage`, `asset-sanctions`: reports. They write nothing.
- `firms-sweep`: reads NASA FIRMS heat. Set `FIRMS_MAP_KEY` first. Run it again after a stop or
  each day: it reads only days that no stored answer covers.

## Write a release

Write the manifest first, outside the checkout, because it holds your contact addresses. The
command refuses an unknown key and names the fault.

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

- Only `contacts` is necessary. Each address starts with `https://` or `mailto:`. The date defaults
  to today (UTC), the version to the date.
- `showNatoPair` is `false`. Set it to `true` only after a change of S1.
- `iriBase` (an `https://` address that ends with a slash) is the base of the JSON-LD identifiers.
  Set it once, to the public site, before the first public release. Never change it after.
- `criticalNodes` is the path of your CSV sheet of candidate nodes, relative to the manifest. Keep
  it outside the checkout. Condition `b` is documented production in 2024-2026; `c` is presence in
  a bypass routing; `a` is ticked by the release itself. `controller` and `bypass_pattern` are public text: name no person that the release does not show.
  A tick with no `claim_ids` shows "not
  sourced" and does not count. The release refuses the sheet when a row names a node or a claim that
  is not public.
- `volumes` is the path of the volume table of the research, relative to the manifest. The release
  rejects a row with no public document, class, value or unit, a period that is not `YYYY-MM`, or an
  estimate with no range, and writes the other rows. It never adds two rows. A fixture holds an
  example table.

Then run, on the record:

```powershell
pnpm worker release --manifest <manifest> --out <folder> --previous <previous release folder>
```

- `--previous` is the last release as you published it. Leave it out for the first release.
- The command writes `gab-release-<date>` and the site `gab-site-<date>`. It builds the application
  once with the files of the release, then writes a file `index.html` in a folder for each page. It
  writes the site first, so a failed run leaves no release folder. It refuses a folder of the same
  date, and a previous folder that disagrees with its checksums.
- The site is for the root of a host. To put it in a folder of the host, set `SITE_BASE` to the
  path, with a slash at each end, as `SITE_BASE=/gab/`.
- The build never holds the address of a read service, whatever `VITE_API_URL` says: the site
  reads the files of the release.
- Each CSV file starts with `#` lines (version, date, disclaimer). A program that reads it must
  skip them.

## Publish the site

1. Put the content of `gab-site-<date>` at the root of a static host. Each page is a folder with
   an `index.html`. A static host serves `/map/` as it stands and normally sends `/map` to
   `/map/`. The reader needs no rewrite rule and no script for the text of a page.
2. A page at a permanent address (the critical nodes, the map, the downloads, the method, an
   entity, a vessel, a claim, a relation) holds its text in the HTML. It opens with no script, and
   the script of the application then takes over. The graph, the search and the review need the
   script. The review says that it is not available when no write service answers.
3. The map needs an `http` or `https` address (MapLibre). To look at the site locally, run
   `python -m http.server 8000` in the site folder.
4. The address `/v1/` gives a short page that links the critical nodes. The site holds no build of
   the version 1 map.

## The application with no backend

The application reads the files of a release when the read service does not answer (ADR 0028).
For `pnpm dev` or `pnpm build`, set `RELEASE_DIR` to a release folder. The build copies the files to
`release/` beside the application. With no read service, each page then says "Version of
DD/MM/YYYY", and the footer gives the two contact links of the release. The release command does
the same build for the public site, and then renders each page that has a permanent address.

## Public writes

No public write path exists. It needs real authentication first, and that is separate work.
