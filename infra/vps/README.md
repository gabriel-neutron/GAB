# infra/vps — the VPS runbook

The VPS does the coding and the tooling. Claude Code runs there. The VPS also runs a **disposable** test stack and one service that holds no record of the
project: SearXNG. The real database, the writer and the worker stay on the operator's Windows PC.
The VPS never holds the real data.

| File | Use |
|---|---|
| `test-stack.env.example` | Copy to `infra/.env` on the VPS. Test values only. |
| `.env.example` | Copy to `~/gab-services/.env`, outside the checkout. The Tailscale address, the image tag, one secret. |
| `services.compose.yml` | SearXNG, bound to the Tailscale address. |
| `../searxng/settings.yml` | SearXNG settings, with JSON output on. One file serves this stack and the local stack. |
| `claude-settings.local.example.json` | Copy to `.claude/settings.local.json` on the VPS. |

Conventions: a non-root user that runs the agents, with checkouts under `~/projects/`. GAB is at
`~/projects/GAB`. Commands marked **PC** run in PowerShell on Windows. Commands marked
**root** need `sudo` (install, systemd, sysctl). All other commands run as that user on the VPS.
That user must be in the `docker` group (`sudo usermod -aG docker "$USER"`, then log in again). After each step, do the **Check**. If a check fails, stop.

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
4. Only you do these steps: the PAT, the Tailscale login (step 1), and the Claude Code login on
   the VPS if it is not done (step 6).

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
mkdir -p ~/projects && cd ~/projects
git clone --branch staging https://github.com/gabriel-neutron/GAB.git
cd GAB && pnpm install --frozen-lockfile
```

`python-is-python3` is necessary: the docs hook in `.claude/settings.json` calls `python`.

**Check:** `node -v` prints `v24.*`, `pnpm -v` prints `11.5.2`, `git branch --show-current`
prints `staging`.

## 3. The disposable test stack

```bash
cd ~/projects/GAB
command -v docker || curl -fsSL https://get.docker.com | sudo sh   # root
sudo usermod -aG docker "$USER"   # root; then log out, log in again, and check that `docker ps` works
cp infra/vps/test-stack.env.example infra/.env
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml up -d --wait db
pnpm db:migrate && pnpm db:apply && pnpm db:reset
pnpm check
```

`infra/.env` on the VPS holds test values only. Never copy the `infra/.env` of the PC to the VPS.
A VPS checkout made before the checker role has no `GABRIEL_CHECKER_PASSWORD`. Copy its
line from `test-stack.env.example` into `infra/.env`, as for each other role password, before
`pnpm db:migrate`. The command stops when one role password is absent.
The ports stay on `127.0.0.1`, as in `infra/docker-compose.yml`.

The stack holds the S3 store (SeaweedFS) on `127.0.0.1:9000`, with the bucket `raw`. Its
accounts take the `RAW_STORE_*_KEY` test values of `infra/.env`.

**Check:** `docker compose -f infra/docker-compose.yml ps` shows `db` and `seaweedfs` healthy, and
`pnpm check` exits 0.

## 4. The GitHub identity of the VPS checkout

`gabriel-neutron` acts on GAB. Never run `gh auth login` or `gh auth switch`: the stored login of
the VPS can be the MerchantOS account. The token is pinned in the GAB checkout only.

```bash
cd ~/projects/GAB
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

## 5. SearXNG on the Tailscale address

The env file stays outside the checkout, in `~/gab-services/`. An agent works in the checkout, and a deny rule does not stop a shell command that reads a file.

```bash
mkdir -p ~/gab-services && chmod 700 ~/gab-services
ENVF=~/gab-services/.env
cp ~/projects/GAB/infra/vps/.env.example "$ENVF" && chmod 600 "$ENVF"
sed -i "s/^BIND_IP=.*/BIND_IP=$(tailscale ip -4)/" "$ENVF"
sed -i "s/^SEARXNG_SECRET=.*/SEARXNG_SECRET=$(openssl rand -hex 32)/" "$ENVF"
docker manifest inspect "searxng/searxng:$(sed -n 's/^SEARXNG_TAG=//p' "$ENVF")" >/dev/null && echo tag-ok
cd ~/projects/GAB/infra/vps
docker compose --env-file "$ENVF" -f services.compose.yml up -d --wait
```

If `tag-ok` does not show, choose a tag from Docker Hub (`searxng/searxng`, format
`YYYY.M.D-<commit>`), and set `SEARXNG_TAG` in `~/gab-services/.env`. Never `latest`.

Docker binds a port only when the address exists. After a reboot, `tailscaled` can start before
it has the address. Let the kernel bind an address that does not exist yet, and make Docker start
after Tailscale, so that a reboot does not lose the service:

```bash
# root: every line of this block uses sudo. A plain `>` would run as the non-root user and fail.
echo 'net.ipv4.ip_nonlocal_bind=1' | sudo tee /etc/sysctl.d/99-gab.conf
sudo sysctl --system
sudo mkdir -p /etc/systemd/system/docker.service.d
printf '[Unit]\nAfter=tailscaled.service\nWants=tailscaled.service\n' \
  | sudo tee /etc/systemd/system/docker.service.d/after-tailscale.conf
sudo systemctl daemon-reload
```

**Fallback with no Tailscale:** set `BIND_IP=127.0.0.1` in `~/gab-services/.env`, run the
`up -d` command again, and on the PC run
`ssh -N -L 8888:127.0.0.1:8888 <user>@<VPS public IP>`.

**Check (VPS):** `ss -ltnp | grep ':8888'` shows only the Tailscale address, never
`0.0.0.0`. `docker compose --env-file ~/gab-services/.env -f services.compose.yml ps` shows
SearXNG healthy. `sysctl net.ipv4.ip_nonlocal_bind` prints `= 1`.
**Check (PC):** `Invoke-RestMethod "http://<VPS_TS_IP>:8888/search?q=test&format=json"` returns
results.

## 6. Claude Code

Claude Code is already on the VPS for MerchantOS. The login belongs to `root`, so GAB uses it.
The project settings come from the repository (`.claude/settings.json`). The local settings of
step 4 add the PAT, an allow list and a deny list. Never use `--dangerously-skip-permissions` here:
the VPS also holds MerchantOS.

The allow list and the deny list reduce mistakes. They are not a security control. `GH_TOKEN` is
in the environment of each agent, and an allowed command such as `node` or `pnpm` can read it or
use it. **The scope of the PAT (step 0) is the only control on the token**, and the rulesets of
step 0 are the only lock on `main`. Keep the PAT on `gabriel-neutron/GAB` alone, with the
permissions of step 0 alone.

The docker compose rules of the allow list name one literal file,
`~/projects/GAB/infra/docker-compose.yml`. A rule compares the text of the command, so the
command must use this `~` form, not the full path. A general `docker compose` rule gives root on the
host: a volume mount can read every file, and `down -v` of another project deletes its data.

The work runs in a session that the operator starts, with the skills of `CLAUDE.md`. No cron job
starts an agent.

```bash
cd ~/projects/GAB
claude -p "Reply with the word ready." --permission-mode acceptEdits   # prints: ready
```

The `visual-qa` agent drives a headless Chromium through the Playwright MCP server of
`.mcp.json`. The VPS has no Google Chrome, so install the browser build that matches the pinned
version of the server:

```bash
npx -y @playwright/mcp@0.0.83 install-browser chrome-for-testing
```

**Check:** in a session, the `visual-qa` agent opens a page and returns a screenshot.

## 7. The PC uses the VPS service

The real database, the writer and the worker stay on the PC. They reach SearXNG through
Tailscale. Every model call goes to OpenRouter (ADR 0010), and no VPS service takes part.

| Name | Value on the PC (`infra/.env`) |
|---|---|
| `SEARXNG_URL` | `http://<VPS_TS_IP>:8888` |
| `OPENROUTER_API_KEY` | the paid key. Set a credit limit on it in the OpenRouter dashboard. |

**Check (PC):** `Invoke-RestMethod "http://<VPS_TS_IP>:8888/search?q=test&format=json"` returns
results. Do not paste the key into a chat or a ticket.

## 8. Rollback, and stop everything

| To stop | Command (VPS, in `~/projects/GAB`) |
|---|---|
| SearXNG | `docker compose --env-file ~/gab-services/.env -f infra/vps/services.compose.yml down` |
| The test stack, keep data | `docker compose -f infra/docker-compose.yml down` |
| The test stack, delete data | `docker compose -f infra/docker-compose.yml down -v` (test data only) |
| GitHub access of the VPS | Revoke the VPS PAT on GitHub. The PC PAT stays valid. |
| Tailscale access | `tailscale down`, or remove the VPS in the Tailscale admin console |

An agent lands its work only as pull requests and branches into `staging`. To undo one, close the
PR, or `git revert` its merge on `staging`. Never force-push `staging`. Keep `down -v` of
`services.compose.yml` for a full reset.

**Check:** `docker ps` shows no container you stopped.

## 9. Daily check list

- [ ] `gh pr list --base staging` (PC) shows the open PRs. No PR targets `main`.
- [ ] `docker ps --format '{{.Names}} {{.Status}}'` shows each container `healthy` or `Up`.
- [ ] The OpenRouter dashboard shows credit left on the key.
- [ ] `df -h /` shows more than 10 GB free.
- [ ] The VPS PAT is valid. A `401 Bad credentials` means that it expired: make a new PAT and
      replace it in `.claude/settings.local.json` (step 4).
