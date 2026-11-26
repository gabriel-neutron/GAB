# infra/vps — the VPS runbook

The VPS does the coding and the tooling. Claude Code runs there. The VPS also runs a **disposable** test stack and one service that holds no record of the
project: SearXNG. The real database, the writer and the worker stay on the operator's Windows PC.
The VPS never holds the real data: no copy, no dump and no file of the record is on its disk. The one
exception to "no access" is the tunnel of section 9: while the PC keeps it open, a VPS session reads
the export documents of the record live, read only. The operator closes it on the PC.

**The tenfold wave (`research/AGENTS.md`).** The operator decided that all work of this wave runs on
the PC, also the code work in a worktree. The VPS and Tailscale take no part, and this runbook does
not apply to the wave. A test on the PC uses a test stack (`pnpm stack:up`, `pnpm stack:down`). A
fault test never runs on the real data.

| File | Use |
|---|---|
| `test-stack.env.example` | Copy to `infra/.env` on the VPS. Test values only. |
| `.env.example` | Copy to `~/gab-services/.env`, outside the checkout. The Tailscale address, the image tag, one secret. |
| `services.compose.yml` | SearXNG, bound to the Tailscale address. |
| `../searxng/settings.yml` | SearXNG settings, with JSON output on. One file serves this stack and the local stack. |
| `claude-settings.local.example.json` | Copy to `.claude/settings.local.json` on the VPS. |
| `~/gab-services/record-tunnel.env` | Written by the PC when it opens the tunnel (section 9), deleted when it closes it. Never in the checkout. |

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
git config --local user.email 267274726+gabriel-neutron@users.noreply.github.com
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

On the VPS, the work runs in a session that the operator starts, with the skills of `CLAUDE.md`. No
cron job on the VPS starts an agent. A per-user scheduled task on the PC starts the workers of the
wave.

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

## 8. The node audit

The audit takes the nodes of the report one by one, with the same checks for each node, and writes
a verdict for each fact and each node. It changes nothing in the record. The method is the verdict of
the panel of 2026-11-26 (osint-expert, software-architect, skeptic), in the head comment of the checks
in `tools/`.

On the VPS the audit reads only the public data release of the report, which the command downloads
and checks against its pinned SHA-256. This is **release mode**. The VPS holds no document of the
record, so the four checks of a stored document (the document exists, its hash, the excerpt at its
page, its level) give `cannot_check` with the reason `needs_record`. A node with no other fault is
`release_pass`, never `pass`. Run **record mode** on the PC for these four checks (`../README.md`,
"The node audit"), or run three of them on the VPS through the tunnel of section 9.

```bash
cd ~/projects/GAB && git switch staging && git pull --ff-only && pnpm install --frozen-lockfile
pnpm node:audit                       # all nodes: report nodes, then critical nodes, then the rest
pnpm node:audit --only-report-nodes   # only the nodes that the report pages name
pnpm node:audit --limit 50            # the next 50 nodes, then stop
```

Time, measured on 2026-11-26 on the release of the report: the first run downloads the release, and
then all nodes take less than 10 seconds. A second run in the same folder audits only the nodes that
are not done: the result file is the progress. A run with other checks or another release in the same
folder stops: give a new folder with `--out <folder>`.

The results are in `node-audit-out/<release>-release/` in the checkout (not committed):

| File | What it holds |
|---|---|
| `results.jsonl` | One header line, one start line (commit, counts of the release, report entities not in the release), then one line for each node: its group, its members, its verdict, and for each fact the result of each check (`pass`, `fail`, `cannot_check`, `not_applicable`, each with a reason). |
| `summary.md` | The nodes by verdict, each check with its counts and its fail rate, the reasons of each fail, the stored "value in excerpt" against the recomputed one, who decided the claims, the flagged designations, and the failed nodes. |
| `failed-claims.txt` | The id of each claim with a failed check. Give it to a reviewer (skill `review-unit`). |

How to read a verdict:

- `fail`: one check of the node or of one of its facts failed. Read the reason in `results.jsonl`.
- `incomplete`: no check failed, but one check could not run (for example `name_only`: the official
  document names the subject but gives no identifier of it).
- `release_pass`: each check that the release allows passed. It is not a check of the stored document.
- A designation with a citation of NATO letter C or F does not fail. `summary.md` lists it as flagged.

**The model check** asks a model of another family whether the excerpts state each fact. It costs
model credit, so it needs the operator. It reads the checker values of the PC environment file
(`CHECKER_*` and `OPENROUTER_API_KEY`). Set them in the shell for the one run, never in a file of the
checkout. Without `--go`, the command prints the number of nodes, the tokens and the estimated cost
from the public price list of OpenRouter, and sends no call:

```bash
pnpm node:audit --model --only-report-nodes --token-cap 1000000        # estimate only
pnpm node:audit --model --only-report-nodes --token-cap 1000000 --go   # spend
```

The model verdicts go into the same `results.jsonl`. A model verdict never makes a failed fixed check
pass. The cap stops the run before a call that goes past it.

What the audit cannot check: that a fact is true (only that its cited excerpt states it); that no
designation is missing; that a list entry is the current entry (the audit reads the stored excerpt,
not the live list); the check digit of a tax number or a registration number; and the claims of an
act or an event alone, which are in no node.

## 9. The record through the tunnel

The audit of every node with the newest data is too heavy for the PC, so the PC lends the record to
the VPS for the time of a run. The verdict of the panel of 2026-11-26 (software-architect, skeptic)
sets the rules:

- **Nothing is copied.** The PC opens a reverse SSH tunnel. The VPS listens on its loopback address
  only, on one port, and the tunnel goes to the database of the PC. The read API and the raw store
  do not go through it.
- **One role, two views.** A VPS session logs in as a role that reads only the documents that a
  release can name (public, level A, not restricted), and the text of their pages. It reads no
  table of the record, calls no function, and writes nothing. A perimeter test holds each of these.
- **One secret, for one tunnel.** Each open gives the role a new password and an end time
  (`GAB_TUNNEL_HOURS`, 8 hours by default). The close takes the login away. The password is in
  `~/gab-services/record-tunnel.env` on the VPS, mode 600, and never in the checkout.
- **What the VPS cannot read:** a restricted document (a register extract, a court act, a bank
  statement, which name natural persons), a document below level A, a document that is not public,
  the stored file of any document, the acts, the proposals and the jobs. The role sees only that the
  id of such a document exists, so the audit can tell it from an absent document.
- **The root login of the VPS is shared with another project.** Mode 600 does not stop root. While
  the tunnel is open, each root process on the VPS can read the export documents and their text.
  Keep the tunnel open only for a run, and close it after.

### Once, by the operator only

1. On the VPS, as root, add the public key of the PC to `~/.ssh/authorized_keys`, with this prefix
   (the port is `GAB_TUNNEL_PORT`):

   ```
   restrict,port-forwarding,permitlisten="127.0.0.1:15432" <the public key of the PC>
   ```

   The prefix lets the key forward that one port, on the loopback address only. It does not stop a
   command: the PC uses the same key to write and delete the secret file and to check the port. So
   the key gives a shell as that user. Keep it on the PC only, and remove the line to cut it.
2. **PC:** in `infra/.env` of the main checkout, set `GAB_TUNNEL_SSH` to `root@<VPS address>` and
   `GAB_TUNNEL_KEY` to the private key file. `GAB_TUNNEL_PORT` and `GAB_TUNNEL_HOURS` are optional.
3. **PC:** in the main checkout, run `pnpm db:migrate` and `pnpm db:apply`. They add the role and
   the two views, and they change no row of the record.

**Check (PC):** `ssh -i <key> root@<VPS address> true` exits 0 with no password prompt.

### Each run

| Where | You want | Run |
|---|---|---|
| PC, main checkout | Open the tunnel | `pnpm record-tunnel:open` |
| VPS | The audit with the record | `pnpm node:audit --record --tunnel ~/gab-services/record-tunnel.env` |
| VPS | The same, 5 report nodes | `pnpm node:audit --record --tunnel ~/gab-services/record-tunnel.env --only-report-nodes --limit 5` |
| PC, main checkout | Close the tunnel | `pnpm record-tunnel:close` |

The open starts the database if it is down. Then it checks as the role that it reads the views and
is refused on a table of the record, opens the tunnel, writes the file on the VPS, and checks on the
VPS that the port listens on `127.0.0.1` only. A failed step closes all again.

The close takes the login of the role, ends its sessions, deletes the file on the VPS and stops the
tunnel. Each step runs when another step fails, and a second close does no harm. When the PC is off,
the end time of the password stops each new login. It does not stop a session that is open already,
and the tunnel stays up while the PC runs: close it with the command.

The audit refuses a tunnel file that another user can read, and a file with another host or another
database. It never falls back to another role. The results are in
`node-audit-out/<release>-tunnel/`, and a result file of a PC run is not resumed. The tunnel
carries no store, so the hash check gives `cannot_check` with the reason `needs_store`, and a node
with no other fault is `incomplete`. A cited document that the role may not read gives
`cannot_check` with the reason `not_export_document`, not a fail. Run these checks on the PC
(`../README.md`, "The node audit").

## 10. Rollback

To stop a service, run `docker compose down` on its file (SearXNG needs `--env-file ~/gab-services/.env`; `down -v` deletes test data only). To cut GitHub access, revoke the VPS PAT: the PC PAT stays valid. A `401 Bad credentials` means that the VPS PAT expired: replace it in `.claude/settings.local.json` (step 4). An agent lands its work as pull requests into `staging`: undo one with `git revert` on `staging`. Never force-push `staging`.
