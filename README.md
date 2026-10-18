# Gabriel

An OSINT data-fusion environment built as a personal investigation instrument. It lets a
single analyst ingest documents, extract and correlate information, and build a graph of
entities and relations in which **every claim carries its source**.

Machine output never becomes evidence on its own. Agents write freely into a **candidate
layer**; only an explicit act of promotion by the analyst moves anything into the
**evidentiary layer** that feeds reports, datasets, and public maps.

**Status: MVP shipped.** The core screens, the worker, and the database gate all pass. Open
work items stay tracked as issues.

## Shape

TypeScript end to end. PostgreSQL/PostGIS is the only GOLD datastore; SeaweedFS, an S3 server, holds the
raw files as they arrived. They stay unchanged by convention: the store does not prevent an
overwrite, because it has no versioning and no object lock. The frontend is React with Vite and
TanStack Router, the component kit is shadcn, and the map library is MapLibre. The build decisions live in the ADR register in
[`docs/README.md`](docs/README.md). Open questions live as
[issues](https://github.com/gabriel-neutron/GAB/issues).

The types of the database are generated from the live schema. `pnpm db:drift` regenerates them
from the test database and fails on a difference. CI runs it, and the database tests, on each pull
request.

Documentation starts at [`docs/README.md`](docs/README.md).

## Start the MCP server

The MCP server `gab` gives the research tools to the AI agent. Its client starts it over stdio. You do
not start it by hand for normal work.

Before you start it:

1. Install the dependencies: `pnpm install`. Node 24 is required.
2. Start the database stack from the root of the repository:

   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```

3. Copy `research/.env.example` to `research/.env`, and set the values.

To start it, open a Claude Code session in the research folder. The file `research/.mcp.json` starts
the server. Check that it runs:

```bash
cd research
claude mcp list
```

`gab` must show as connected.

To run the server alone, from the root of the repository:

```bash
node packages/mcp/src/main.ts
```

The server then waits for a client on stdin, so it shows no prompt. Stop it with Ctrl+C.

If the server does not start, it prints the cause on stderr:

- The database does not answer: start the stack (step 2).
- The password is wrong: set `GAB_RESEARCH_DATABASE_URL` with the value of
  `GABRIEL_RESEARCH_PASSWORD` in `infra/.env`.
- The database name is wrong: name the database `gabriel`.

## License

MIT — see [`LICENSE`](LICENSE).
