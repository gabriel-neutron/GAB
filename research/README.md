# Start a research session on Windows

Git tracks only the shared setup in this folder: this README, the agent instructions, the MCP
configuration, the environment example, and the shared Claude configuration, skills and workflows
under `.claude`. Local settings and worktrees stay ignored. All other research files stay local.
Keep credentials in the ignored `.env` file. Never add them to the environment example.

Run these five lines in PowerShell, from the root of the repository. Docker Desktop must run, and
the stack must have its `infra/.env` and its database (`infra/README.md`).

```powershell
pnpm install
pnpm exec playwright install chromium
docker compose -f infra/docker-compose.yml up -d
Copy-Item research/.env.example research/.env; notepad research/.env
cd research; claude mcp list
```

Line 4 opens the environment file: put the values that its comments name. Line 5 must show the
server `gab` as connected. Then start `claude` in the folder `research`. The server
reads `research/.env` by itself, so it also starts from the root of the repository, where
`.mcp.json` names it too. The research rules and skills load only in the
folder `research`. Claude Code finds the server from the folder of its project. Claude Code asks before
each decision and before each job that it queues. It does not ask before `propose`, which spends
one checker call for each batch. In the mode that skips permissions, Claude Code asks nothing. Do
not use that mode for a review.

The server reads the checker of the proposals from `infra/.env` of the repository, wherever the
client starts it: `OPENROUTER_API_KEY`, the `CHECKER_` values, `RESEARCH_CHECK_TOKEN_CAP` and
`GABRIEL_CHECKER_PASSWORD`. Never put these values in `research/.env`. When
one is absent, the server starts. Each proposal then waits with no check, and the answer of
`propose` names the value.

## Run the server alone

From the root of the repository, run `pnpm mcp`. The server then waits for a client on stdin, so it
shows no prompt. Stop it with Ctrl+C.

## Share one server between sessions

The default is one stdio process for each session. To serve many sessions with one process, start
the shared mode from the root of the repository:

```bash
pnpm mcp:serve
```

The server listens on `http://127.0.0.1:7420/mcp`. To use another port, run
`node packages/mcp/src/main.ts --http <port>` or set `GAB_MCP_HTTP_PORT`. The server binds to the
loopback address only, and it refuses a request whose Host or Origin is not loopback. Each client
gets its own session, and the database pools and workers are shared.

A project points its `gab` entry to the server with local scope, so the checked-in `.mcp.json`
stays on stdio for every clone:

```bash
claude mcp add --scope local --transport http gab http://127.0.0.1:7420/mcp
```

The process keeps the code it started with. After a pull that changes the server, stop it and start
it again, then reconnect the sessions.

If the server does not start, it prints the cause on stderr:

- The database does not answer: start the stack.
- The password is wrong: set `GAB_RESEARCH_DATABASE_URL` with the value of
  `GABRIEL_RESEARCH_PASSWORD` in `infra/.env`.
- The database name is wrong: name the database `gabriel`.
