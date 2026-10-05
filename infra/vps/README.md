# infra/vps — the VPS runbook

The VPS does the coding and the tooling. Claude Code runs there, and a cron job starts the night
run. The VPS also runs a **disposable** test stack and two services that hold no record of the
project: freellmapi and SearXNG. freellmapi keeps the provider keys in its volume. The real database, the writer and the worker stay on the operator's Windows PC. The VPS
never holds the real data.

| File | Use |
|---|---|
| `test-stack.env.example` | Copy to `infra/.env` on the VPS. Test values only. |
| `.env.example` | Copy to `/home/claude/gab-services/.env`, outside the checkout. The Tailscale address, the image tags, two secrets. |
| `services.compose.yml` | freellmapi and SearXNG, bound to the Tailscale address. |
| `../searxng/settings.yml` | SearXNG settings, with JSON output on. One file serves this stack and the local stack. |
| `claude-settings.local.example.json` | Copy to `.claude/settings.local.json` on the VPS. |
| `night-run.sh` | The night run: lock, checks, time limit, `claude -p`. |

Conventions: the user `claude`, checkouts under `/home/claude/projects/`. GAB is at
`/home/claude/projects/GAB`. Commands marked **PC** run in PowerShell on Windows. Commands marked
**root** need `sudo` (install, systemd, sysctl). All other commands run as `claude` on the VPS.
The user `claude` must be in the `docker` group (`sudo usermod -aG docker claude`, then log in again). After each step, do the **Check**. If a check fails, stop.

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
sudo tailscale up       # root; open the URL that it prints, and log in
tailscale ip -4         # write down this address: VPS_TS_IP
```

**PC:** install Tailscale for Windows from tailscale.com, and log in with the same account.

**Check (PC):** `tailscale status` lists the VPS, and `Test-NetConnection <VPS_TS_IP> -Port 22`
shows `TcpTestSucceeded : True`.

## 2. Clone GAB, Node 24, pnpm 11.5.2

`package.json` sets Node `^24` and `pnpm@11.5.2`. The host has one Node version, so no version
manager is used: the system Node must be 24.

```bash
sudo apt-get update && sudo apt-get install -y git jq python-is-python3 unzip   # root
node -v                       # must print v24.*; else install Node 24 from NodeSource (root)
sudo corepack enable          # root
mkdir -p /home/claude/projects && cd /home/claude/projects
git clone --branch staging https://github.com/gabriel-neutron/GAB.git
cd GAB && pnpm install --frozen-lockfile
```

`python-is-python3` is necessary: the docs hook in `.claude/settings.json` calls `python`.

**Check:** `node -v` prints `v24.*`, `pnpm -v` prints `11.5.2`, `git branch --show-current`
prints `staging`.

## 3. The disposable test stack

```bash
cd /home/claude/projects/GAB
command -v docker || curl -fsSL https://get.docker.com | sudo sh   # root
sudo usermod -aG docker claude   # root; then log out, log in again, and check that `docker ps` works
cp infra/vps/test-stack.env.example infra/.env
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml up -d --wait db
pnpm db:migrate && pnpm db:apply && pnpm db:reset
pnpm check
```

`infra/.env` on the VPS holds test values only. Never copy the `infra/.env` of the PC to the VPS.
The ports stay on `127.0.0.1`, as in `infra/docker-compose.yml`.

The stack holds the S3 store (SeaweedFS) on `127.0.0.1:9000`, with the bucket `raw`. Its three
accounts take the six `RAW_STORE_*_KEY` test values of `infra/.env`.

**Check:** `docker compose -f infra/docker-compose.yml ps` shows `db` and `seaweedfs` healthy, and
`pnpm check` exits 0.

## 4. The GitHub identity of the VPS checkout

`gabriel-neutron` acts on GAB. Never run `gh auth login` or `gh auth switch`: the stored login of
the VPS can be the MerchantOS account. The token is pinned in the GAB checkout only.

```bash
cd /home/claude/projects/GAB
command -v gh || sudo apt-get install -y gh   # root
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

The env file stays outside the checkout, in `/home/claude/gab-services/`. An agent of the night run
works in the checkout, and a deny rule does not stop a shell command that reads a file.

```bash
mkdir -p /home/claude/gab-services && chmod 700 /home/claude/gab-services
ENVF=/home/claude/gab-services/.env
cp /home/claude/projects/GAB/infra/vps/.env.example "$ENVF" && chmod 600 "$ENVF"
sed -i "s/^BIND_IP=.*/BIND_IP=$(tailscale ip -4)/" "$ENVF"
sed -i "s/^FREELLMAPI_ENCRYPTION_KEY=.*/FREELLMAPI_ENCRYPTION_KEY=$(openssl rand -hex 32)/" "$ENVF"
sed -i "s/^SEARXNG_SECRET=.*/SEARXNG_SECRET=$(openssl rand -hex 32)/" "$ENVF"
docker manifest inspect ghcr.io/tashfeenahmed/freellmapi:v0.13.3 >/dev/null && echo tag-ok
cd /home/claude/projects/GAB/infra/vps
docker compose --env-file "$ENVF" -f services.compose.yml up -d --wait
```

If `tag-ok` does not show, find the tag on the package page of the freellmapi repository, and
set `FREELLMAPI_TAG` in `/home/claude/gab-services/.env`. For SearXNG, choose a tag from Docker Hub
(`searxng/searxng`, format `YYYY.M.D-<commit>`). Never `latest`.

Docker binds a port only when the address exists. After a reboot, `tailscaled` can start before
it has the address. Let the kernel bind an address that does not exist yet, and make Docker start
after Tailscale, so that a reboot does not lose the two services:

```bash
# root: every line of this block uses sudo. A plain `>` would run as claude and fail.
echo 'net.ipv4.ip_nonlocal_bind=1' | sudo tee /etc/sysctl.d/99-gab.conf
sudo sysctl --system
sudo mkdir -p /etc/systemd/system/docker.service.d
printf '[Unit]\nAfter=tailscaled.service\nWants=tailscaled.service\n' \
  | sudo tee /etc/systemd/system/docker.service.d/after-tailscale.conf
sudo systemctl daemon-reload
```

Then, **PC:** open `http://<VPS_TS_IP>:4001` in a browser. Enter the provider keys on the
**Keys** page. Copy the unified key (`freellmapi-...`) into the `infra/.env` of the PC (step 7).

**Fallback with no Tailscale:** set `BIND_IP=127.0.0.1` in `/home/claude/gab-services/.env`, run the
`up -d` command again, and on the PC run
`ssh -N -L 4001:127.0.0.1:4001 -L 8888:127.0.0.1:8888 claude@<VPS public IP>`.

**Check (VPS):** `ss -ltnp | grep -E ':4001|:8888'` shows only the Tailscale address, never
`0.0.0.0`. `docker compose --env-file /home/claude/gab-services/.env -f services.compose.yml ps` shows
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
`/home/claude/projects/GAB/infra/docker-compose.yml`. A general `docker compose` rule gives root on the
host: a volume mount can read every file, and `down -v` of another project deletes its data.

```bash
cd /home/claude/projects/GAB
claude -p "Reply with the word ready." --permission-mode acceptEdits   # prints: ready
chmod +x infra/vps/night-run.sh
mkdir -p /home/claude/logs/gab-night
crontab -e
```

Add these lines. The times are UTC. The run starts at 00:30 UTC and stops at 05:30 UTC at the
latest (`GAB_NIGHT_LIMIT`, default `5h`). Replace `<phase>` (the issue number of the phase ticket) and `<epic>` (the issue that gets the report) before each phase.

```cron
30 0 * * * /home/claude/projects/GAB/infra/vps/night-run.sh <phase> <epic>
0 6 * * 0 find /home/claude/logs/gab-night -name '*.log' -mtime +30 -delete
```

### A named queue instead of the free tickets of a phase

`night-run.sh <phase> <epic>` takes up to four `ready-for-agent` tickets of the phase that have no
open blocker. A chain of tickets that wait for each other then advances one level each night. To
work a chain in one run, give a third argument: a queue file in the checkout.

```bash
/home/claude/projects/GAB/infra/vps/night-run.sh <phase> <epic> infra/vps/queues/rating-pipeline-1.json
```

The file holds `tickets` (in order, each with `n` and an optional `after`), an optional `resume` and
an optional `maxRounds` (1 to 5). `after` is a hard dependency: the ticket is skipped when its
dependency fails. `resume` names a ticket whose pull request an earlier run left at `needs_human`:
the run continues on that branch and that pull request, and it does not flag them as work of
somebody else. The script reads the file as data. It refuses the run when a field is not a whole
number, or when a branch is not of the form `fix/<n>-<slug>`.

A queue of four tickets can take most of the night limit. Put in a file only the tickets that you
want in one run.

Run `crontab -e` as the user `claude`, never as root. The script sets its own PATH, so the
cron file needs no PATH line. The script holds `flock` on `~/.local/state/gab-night.lock`, so two runs never overlap. Before Claude
Code starts, it stops on a wrong identity, a branch that is not `staging`, uncommitted changes,
or a test stack that is not healthy. The log is
`/home/claude/logs/gab-night/<UTC time>-phase<n>.log`.

The allow list is a first version. After the first run, search the log for a refused tool call.
Add a command to the allow list only when it is safe for an agent that nobody watches.

**Check:** run the script once by hand on a small epic:
`/home/claude/projects/GAB/infra/vps/night-run.sh <phase> <epic>`. The check passes only when the report
comment of the run is on the epic issue. `END status=0` in the log alone does not prove that the
workflow ended: `claude -p` can exit 0 after a refused tool call, or before the background
workflow ran. The last line of the log gives the time of the last comment on the epic. Also, `tail -n 20
/home/claude/logs/gab-night/*.log` shows `START`, then `END status=0`. Run it a second time while the
first runs: the second log shows `STOP: another night run holds`.

## 7. The PC uses the VPS services

The real database, the writer and the worker stay on the PC. They reach freellmapi and SearXNG
through Tailscale. `packages/model/src/client.ts` reads the two model names below. The name of
the SearXNG address does not exist in the code yet: the build ticket of ADR 0010 §9 step 6 must
fix it.

| Name | Value on the PC (`infra/.env`) |
|---|---|
| `FREELLMAPI_BASE_URL` | `http://<VPS_TS_IP>:4001/v1` |
| `FREELLMAPI_API_KEY` | the unified `freellmapi-...` key from the dashboard |
| `GABRIEL_SEARCH_URL` | `http://<VPS_TS_IP>:8888` (name not fixed yet) |

`OPENROUTER_API_KEY` stays the paid switch (ADR 0010 §4). An agent chooses its gateway with its
`endpoint` setting, `freellmapi` or `openrouter`, and the code has no default.

**Check (PC):** with the key in `$k`,
`Invoke-RestMethod http://<VPS_TS_IP>:4001/v1/models -Headers @{Authorization="Bearer $k"}`
lists the models. Do not paste the key into a chat or a ticket.

## 8. Rollback, and stop everything

| To stop | Command (VPS, in `/home/claude/projects/GAB`) |
|---|---|
| The night run, for good | `crontab -e`, put `#` before the `night-run.sh` line |
| A run that is in progress | `pkill -f night-run.sh; pkill -f 'claude -p GAB night run'` |
| freellmapi and SearXNG | `docker compose --env-file /home/claude/gab-services/.env -f infra/vps/services.compose.yml down` |
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

- [ ] `tail -n 30 "$(ls -t /home/claude/logs/gab-night/*.log | head -1)"` ends with `END status=0`.
      `124` means the time limit stopped the run.
- [ ] `gh pr list --base staging` (PC) shows the PRs of the night. No PR targets `main`.
- [ ] The report comment is on the epic issue.
- [ ] `docker ps --format '{{.Names}} {{.Status}}'` shows each container `healthy` or `Up`.
- [ ] The freellmapi dashboard shows quota left for the day.
- [ ] `df -h /` shows more than 10 GB free.
- [ ] The VPS PAT is valid. A `401 Bad credentials` means that it expired: make a new PAT and
      replace it in `.claude/settings.local.json` (step 4).
