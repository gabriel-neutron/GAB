# Start a research session on Windows

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
server `gab` as connected. Then start `claude` or `codex` in the folder `research`.

The server reads the checker of the proposals from `infra/.env` of the repository, wherever the
client starts it: `OPENROUTER_API_KEY`, the `CHECKER_` values and `RESEARCH_CHECK_TOKEN_CAP`. When
one is absent, the server starts, and each proposal is disputed with the name of the value.
