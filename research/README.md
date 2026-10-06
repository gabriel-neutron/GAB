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
