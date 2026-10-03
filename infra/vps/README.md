# infra/vps — the VPS runbook

The VPS does the coding and the tooling. Claude Code runs there, and a cron job starts the night
run. The VPS also runs a **disposable** test stack and two services that hold no record of the
project: freellmapi and SearXNG. freellmapi keeps the provider keys in its volume. The real database, the writer and the worker stay on the operator's Windows PC. The VPS
never holds the real data.

| File | Use |
|---|---|
| `test-stack.env.example` | Copy to `infra/.env` on the VPS. Test values only. |
| `.env.example` | Copy to `/root/gab-services/.env`, outside the checkout. The Tailscale address, the image tags, two secrets. |
| `services.compose.yml` | freellmapi and SearXNG, bound to the Tailscale address. |
| `searxng/settings.yml` | SearXNG settings, with JSON output on. |
| `claude-settings.local.example.json` | Copy to `.claude/settings.local.json` on the VPS. |
| `night-run.sh` | The night run: lock, checks, time limit, `claude -p`. |

Conventions, the same as MerchantOS: user `root`, checkouts under `/root/projects/`. GAB is at
`/root/projects/GAB`. Commands marked **PC** run in PowerShell on Windows. All other commands
run as root on the VPS. After each step, do the **Check**. If a check fails, stop.

## 0. Prerequisites, and what only the operator can do

1. Commit and push the `infra/vps/` folder to `staging`. The VPS clones from GitHub.
2. Make a **new** fine-grained PAT for the VPS. Owner `gabriel-neutron`, repository
   `gabriel-neutron/GAB` only. Permissions: Contents, Issues and Pull requests, read and write.
   Use a different PAT from the PC, so that you can revoke one and keep the other.
3. On GitHub, **Settings > Rules > Rulesets**, add two branch rulesets. Set each to **Active**.
   - On `main`: **Restrict updates** and **Block force pushes**. Keep the bypass list
     **empty**. Nobody, the operator included, can then push or merge into `main`. To promote
     `staging` to `main`, the operator sets the ruleset to **Disabled**, merges, and sets it to
     **Active** again at once.
   - On `staging`: **Block force pushes** and **Restrict deletions**.

   A PAT with Contents write can push to every branch. The deny rules in
   `.claude/settings.local.json` are not a control: an agent can push with another spelling of
   the command. The ruleset is the control on `main`.
4. Only you do these steps: the PAT, the Tailscale login (step 1), the freellmapi provider keys
   (step 5), and the Claude Code login on the VPS if it is not done (step 6).

**Check:** `git ls-remote --heads https://github.com/gabriel-neutron/GAB staging` prints one line,
and the commit holds `infra/vps/`. On GitHub, **Settings > Rules > Rulesets** shows both rulesets
**Active**, and the bypass list of the `main` ruleset is empty.

## 1. Tailscale on the VPS and on the PC

```bash
command -v tailscale || curl -fsSL https://tailscale.com/install.sh | sh
tailscale up            # open the URL that it prints, and log in
tailscale ip -4         # write down this address: VPS_TS_IP
```

**PC:** install Tailscale for Windows from tailscale.com, and log in with the same account.

**Check (PC):** `tailscale status` lists the VPS, and `Test-NetConnection <VPS_TS_IP> -Port 22`
shows `TcpTestSucceeded : True`.

## 2. Clone GAB, Node 24, pnpm 11.5.2

`package.json` sets Node `^24` and `pnpm@11.5.2`. MerchantOS uses Node 22, so do not change the
default node of the host. fnm gives Node 24 to GAB only.

```bash
apt-get update && apt-get install -y git jq python-is-python3 unzip
curl -fsSL https://fnm.vercel.app/install | bash -s -- --skip-shell
export PATH="/root/.local/share/fnm:$PATH"; eval "$(fnm env --shell bash)"
fnm install 24 && fnm use 24
corepack enable
mkdir -p /root/projects && cd /root/projects
git clone --branch staging https://github.com/gabriel-neutron/GAB.git
cd GAB && pnpm install --frozen-lockfile
```

`python-is-python3` is necessary: the docs hook in `.claude/settings.json` calls `python`.
Do not put fnm in `~/.bashrc`: it can change the node of the MerchantOS shells. In each new shell,
run the `export` and `eval` lines above, then `fnm use 24`, before a GAB command.

**Check:** `node -v` prints `v24.*`, `pnpm -v` prints `11.5.2`, `git branch --show-current`
prints `staging`.

## 3. The disposable test stack

```bash
cd /root/projects/GAB
command -v docker || curl -fsSL https://get.docker.com | sh
cp infra/vps/test-stack.env.example infra/.env
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml up -d --wait db
pnpm db:migrate && pnpm db:apply && pnpm db:reset
pnpm check
```

`infra/.env` on the VPS holds test values only. Never copy the `infra/.env` of the PC to the VPS.
The ports stay on `127.0.0.1`, as in `infra/docker-compose.yml`. An exited `minio-init` is normal.

**Check:** `docker compose -f infra/docker-compose.yml ps` shows `db` healthy, and `pnpm check`
exits 0.

## 4. The GitHub identity of the VPS checkout

`gabriel-neutron` acts on GAB. Never run `gh auth login` or `gh auth switch`: the stored login of
the VPS can be the MerchantOS account. The token is pinned in the GAB checkout only.

```bash
cd /root/projects/GAB
command -v gh || apt-get install -y gh
cp infra/vps/claude-settings.local.example.json .claude/settings.local.json
chmod 600 .claude/settings.local.json
nano .claude/settings.local.json     # replace PASTE-THE-VPS-PAT-HERE with the PAT
git config --local user.name gabriel-neutron
git config --local user.email gabriel-neutron@users.noreply.github.com
git config --local credential.helper ''
git config --local --add credential.helper '!gh auth git-credential'
```

The empty helper clears the global helper for this checkout only. `gh auth git-credential` then
gives git the `GH_TOKEN` of the environment.

**Check:**

```bash
export GH_TOKEN="$(jq -r .env.GH_TOKEN .claude/settings.local.json)"
gh api user --jq .login          # must print: gabriel-neutron
git push --dry-run origin staging   # must end with: Everything up-to-date
unset GH_TOKEN
```

## 5. freellmapi and SearXNG on the Tailscale address

The env file stays outside the checkout, in `/root/gab-services/`. An agent of the night run
works in the checkout, and a deny rule does not stop a shell command that reads a file.

```bash
mkdir -p /root/gab-services && chmod 700 /root/gab-services
ENVF=/root/gab-services/.env
cp /root/projects/GAB/infra/vps/.env.example "$ENVF" && chmod 600 "$ENVF"
sed -i "s/^BIND_IP=.*/BIND_IP=$(tailscale ip -4)/" "$ENVF"
sed -i "s/^FREELLMAPI_ENCRYPTION_KEY=.*/FREELLMAPI_ENCRYPTION_KEY=$(openssl rand -hex 32)/" "$ENVF"
sed -i "s/^SEARXNG_SECRET=.*/SEARXNG_SECRET=$(openssl rand -hex 32)/" "$ENVF"
docker manifest inspect ghcr.io/tashfeenahmed/freellmapi:v0.13.3 >/dev/null && echo tag-ok
cd /root/projects/GAB/infra/vps
docker compose --env-file "$ENVF" -f services.compose.yml up -d --wait
```

If `tag-ok` does not show, find the tag on the package page of the freellmapi repository, and
set `FREELLMAPI_TAG` in `/root/gab-services/.env`. For SearXNG, choose a tag from Docker Hub
(`searxng/searxng`, format `YYYY.M.D-<commit>`). Never `latest`.

Docker binds a port only when the address exists. After a reboot, `tailscaled` can start before
it has the address. Let the kernel bind an address that does not exist yet, and make Docker start
after Tailscale, so that a reboot does not lose the two services:

```bash
echo 'net.ipv4.ip_nonlocal_bind=1' > /etc/sysctl.d/99-gab.conf
sysctl --system
mkdir -p /etc/systemd/system/docker.service.d
printf '[Unit]\nAfter=tailscaled.service\nWants=tailscaled.service\n' \
  > /etc/systemd/system/docker.service.d/after-tailscale.conf
systemctl daemon-reload
```

Then, **PC:** open `http://<VPS_TS_IP>:4001` in a browser. Enter the provider keys on the
**Keys** page. Copy the unified key (`freellmapi-...`) into the `infra/.env` of the PC (step 7).

**Fallback with no Tailscale:** set `BIND_IP=127.0.0.1` in `/root/gab-services/.env`, run the
`up -d` command again, and on the PC run
`ssh -N -L 4001:127.0.0.1:4001 -L 8888:127.0.0.1:8888 root@<VPS public IP>`.

**Check (VPS):** `ss -ltnp | grep -E ':4001|:8888'` shows only the Tailscale address, never
`0.0.0.0`. `docker compose --env-file /root/gab-services/.env -f services.compose.yml ps` shows
both services healthy. `sysctl net.ipv4.ip_nonlocal_bind` prints `= 1`.
**Check (PC):** `Invoke-RestMethod "http://<VPS_TS_IP>:8888/search?q=test&format=json"` returns
results, and `Invoke-RestMethod http://<VPS_TS_IP>:4001/api/ping` answers.

## 6. Claude Code and the night run

Claude Code is already on the VPS for MerchantOS. The login belongs to `root`, so GAB uses it.
The project settings come from the repository (`.claude/settings.json`). The local settings of
step 4 add the PAT, an allow list and a deny list. The night run uses
`--permission-mode acceptEdits`: a tool call outside the allow list is refused, and no prompt
waits. Never use `--dangerously-skip-permissions` here: the VPS also holds MerchantOS.

The allow list and the deny list reduce mistakes. They are not a security control. `GH_TOKEN` is
in the environment of each agent, and an allowed command such as `node` or `pnpm` can read it or
use it. **The scope of the PAT (step 0) is the only control on the token**, and the rulesets of
step 0 are the only lock on `main`. Keep the PAT on `gabriel-neutron/GAB` alone, with the
permissions of step 0 alone.

The docker compose rules of the allow list name one literal file,
`/root/projects/GAB/infra/docker-compose.yml`. A general `docker compose` rule gives root on the
host: a volume mount can read every file, and `down -v` of another project deletes its data.

```bash
cd /root/projects/GAB
claude -p "Reply with the word ready." --permission-mode acceptEdits   # prints: ready
chmod +x infra/vps/night-run.sh
mkdir -p /root/logs/gab-night
crontab -e
```

Add these lines. The times are UTC. The run starts at 00:30 UTC and stops at 05:30 UTC at the
latest (`GAB_NIGHT_LIMIT`, default `5h`). Replace `<phase>` (the issue number of the phase ticket) and `<epic>` (the issue that gets the report) before each phase.

```cron
PATH=/root/.local/bin:/root/.local/share/fnm:/usr/local/bin:/usr/bin:/bin
30 0 * * * /root/projects/GAB/infra/vps/night-run.sh <phase> <epic>
0 6 * * 0 find /root/logs/gab-night -name '*.log' -mtime +30 -delete
```

The script holds `flock` on `/var/lock/gab-night.lock`, so two runs never overlap. Before Claude
Code starts, it stops on a wrong identity, a branch that is not `staging`, uncommitted changes,
or a test stack that is not healthy. The log is
`/root/logs/gab-night/<UTC time>-phase<n>.log`.

The allow list is a first version. After the first run, search the log for a refused tool call.
Add a command to the allow list only when it is safe for an agent that nobody watches.

**Check:** run the script once by hand on a small epic:
`/root/projects/GAB/infra/vps/night-run.sh <phase> <epic>`. The check passes only when the report
comment of the run is on the epic issue. `END status=0` in the log alone does not prove that the
workflow ended: `claude -p` can exit 0 after a refused tool call. Also, `tail -n 20
/root/logs/gab-night/*.log` shows `START`, then `END status=0`. Run it a second time while the
first runs: the second log shows `STOP: another night run holds`.

## 7. The PC uses the VPS services

The real database, the writer and the worker stay on the PC. They reach freellmapi and SearXNG
through Tailscale. **The names below do not exist in the code yet.** Today
`packages/model/src/client.ts` has a fixed OpenRouter address. The build tickets of ADR 0010 §4
(endpoint setting) and §9 step 6 (SearXNG) must fix the final names.

| Name to be fixed by the build tickets | Value on the PC (`infra/.env`) |
|---|---|
| `GABRIEL_MODEL_ENDPOINT` | `http://<VPS_TS_IP>:4001/v1` |
| `GABRIEL_MODEL_KEY` | the unified `freellmapi-...` key from the dashboard |
| `GABRIEL_SEARCH_URL` | `http://<VPS_TS_IP>:8888` |

`OPENROUTER_API_KEY` stays the paid switch (ADR 0010 §4).

**Check (PC):** with the key in `$k`,
`Invoke-RestMethod http://<VPS_TS_IP>:4001/v1/models -Headers @{Authorization="Bearer $k"}`
lists the models. Do not paste the key into a chat or a ticket.

## 8. Rollback, and stop everything

| To stop | Command (VPS, in `/root/projects/GAB`) |
|---|---|
| The night run, for good | `crontab -e`, put `#` before the `night-run.sh` line |
| A run that is in progress | `pkill -f night-run.sh; pkill -f 'claude -p GAB night run'` |
| freellmapi and SearXNG | `docker compose --env-file /root/gab-services/.env -f infra/vps/services.compose.yml down` |
| The test stack, keep data | `docker compose -f infra/docker-compose.yml down` |
| The test stack, delete data | `docker compose -f infra/docker-compose.yml down -v` (test data only) |
| GitHub access of the VPS | Revoke the VPS PAT on GitHub. The PC PAT stays valid. |
| Tailscale access | `tailscale down`, or remove the VPS in the Tailscale admin console |

A bad night run lands only as pull requests and branches into `staging`. To undo one, close the
PR, or `git revert` its merge on `staging`. Never force-push `staging`. Keep `down -v` of
`services.compose.yml` for a full reset: it deletes the freellmapi volume and its provider keys.

**Check:** `crontab -l | grep night-run` shows the line with `#`, and `docker ps` shows no
container you stopped.

## 9. Daily check list

- [ ] `tail -n 30 "$(ls -t /root/logs/gab-night/*.log | head -1)"` ends with `END status=0`.
      `124` means the time limit stopped the run.
- [ ] `gh pr list --base staging` (PC) shows the PRs of the night. No PR targets `main`.
- [ ] The report comment is on the epic issue.
- [ ] `docker ps --format '{{.Names}} {{.Status}}'` shows each container `healthy` or `Up`.
- [ ] The freellmapi dashboard shows quota left for the day.
- [ ] `df -h /` shows more than 10 GB free.
- [ ] The VPS PAT is valid. A `401 Bad credentials` means that it expired: make a new PAT and
      replace it in `.claude/settings.local.json` (step 4).
