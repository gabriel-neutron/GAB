#!/usr/bin/env bash
# The night run of GAB on the VPS. Cron of the user `claude` starts it (infra/vps/README.md, step 6).
#
# Usage: night-run.sh <phase> <epic> [queue-file]
#   phase       the issue number of the phase ticket (args.phase of resolve-ticket)
#   epic        the issue number that gets the run report
#   queue-file  optional. A JSON file in the checkout (for example infra/vps/queues/<name>.json) that
#               names the tickets of the night, in order, instead of the free tickets of the phase:
#               {"tickets": [{"n": 198}, {"n": 199, "after": [198]}],
#                "resume": {"201": {"branch": "fix/201-web-access-tools", "pr": 253}}, "maxRounds": 3,
#                "base": "integration/<name>"}
#               With a base, every ticket merges into that integration branch, and the run ends with
#               ONE pull request from it to staging (the spec stage of resolve-ticket). Without a base,
#               each ticket merges into staging.
#               Only whole numbers, a branch name of the form fix/<n>-<slug> and a base of the form
#               integration/<name> are accepted.
#
# The script stops before Claude Code starts when one of these is false:
#   - no other night run holds the lock;
#   - the GitHub identity is gabriel-neutron;
#   - the checkout is on staging and is clean;
#   - the disposable test stack is healthy.
set -euo pipefail

PHASE="${1:?give the phase number}"
EPIC="${2:?give the epic issue number}"
QUEUE="${3:-}"
# The whole run stops after this time. Claude Code gets SIGTERM, then SIGKILL 5 minutes later.
LIMIT="${GAB_NIGHT_LIMIT:-5h}"

# `su claude` can leave HOME=/root, so the home comes from the account and not from the variable.
USER_HOME="$(getent passwd "$(id -u)" | cut -d: -f6)"
if [ -z "$USER_HOME" ]; then
  echo "STOP: no home directory for $(id -un)" >&2
  exit 1
fi
export HOME="$USER_HOME"

# The checkout is the one that holds this script, so the path is never written twice.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO="${GAB_REPO:-$(cd -- "$SCRIPT_DIR/../.." && pwd)}"
LOG_DIR="${GAB_LOG_DIR:-$HOME/logs/gab-night}"
LOCK="$HOME/.local/state/gab-night.lock"

# Cron gives a short PATH. The host has one Node version, so the system node and the user tools
# are enough.
export PATH="$HOME/.local/bin:$HOME/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin"

umask 077
mkdir -p "$LOG_DIR" "$(dirname "$LOCK")"
LOG="$LOG_DIR/$(date -u +%Y-%m-%dT%H%M%SZ)-phase$PHASE-epic$EPIC.log"
# tee keeps the output on the terminal of a run by hand, and in the log for cron.
exec > >(tee -a "$LOG") 2>&1

# One run at a time. A second run that finds the lock held stops at once.
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -u +%FT%TZ) STOP: another night run holds $LOCK"
  exit 0
fi

# A missing tool would only show as an empty version, and the run would fail later.
for TOOL in node pnpm gh jq docker; do
  command -v "$TOOL" >/dev/null || { echo "STOP: $TOOL missing from PATH"; exit 1; }
done
# package.json requires Node 24. An older system node fails late, in the install or the build.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 24 ] || { echo "STOP: node $(node -v) is too old; GAB needs Node 24"; exit 1; }
CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude || true)}"
[ -n "$CLAUDE_BIN" ] || { echo "STOP: claude missing from PATH"; exit 1; }

echo "$(date -u +%FT%TZ) START phase=$PHASE epic=$EPIC user=$(id -un) repo=$REPO node=$(node -v) pnpm=$(pnpm -v)"
cd "$REPO"

# The token comes from the settings file, else from the git credential of this checkout. It is
# read into the environment and never printed.
GH_TOKEN=""
if [ -f .claude/settings.local.json ]; then
  GH_TOKEN="$(jq -er '.env.GH_TOKEN // empty' .claude/settings.local.json 2>/dev/null || true)"
fi
if [ -z "$GH_TOKEN" ]; then
  GH_TOKEN="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null \
    | awk -F= '$1 == "password" { print substr($0, 10); exit }' || true)"
fi
[ -n "$GH_TOKEN" ] || { echo "STOP: no GitHub token"; exit 1; }
export GH_TOKEN
LOGIN="$(gh api user --jq .login)"
if [ "$LOGIN" != "gabriel-neutron" ]; then
  echo "STOP: gh acts as '$LOGIN', not gabriel-neutron"
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "staging" ]; then
  echo "STOP: the checkout is on '$BRANCH', not staging"
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "STOP: the checkout has changes that are not committed"
  git status --short
  exit 1
fi
git fetch --prune origin
git merge --ff-only origin/staging
pnpm install --frozen-lockfile

# The compose file refuses to start without this key, and a new key would make the provider keys
# in the freellmapi volume unreadable. So the key is added once and an existing key stays.
if ! grep -Eq '^FREELLMAPI_ENCRYPTION_KEY=.+' infra/.env 2>/dev/null; then
  touch infra/.env
  ENV_TMP="$(mktemp)"
  grep -Ev '^FREELLMAPI_ENCRYPTION_KEY=[[:space:]]*$' infra/.env > "$ENV_TMP" || true
  [ -z "$(tail -c1 "$ENV_TMP")" ] || echo >> "$ENV_TMP"
  echo "FREELLMAPI_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> "$ENV_TMP"
  cat "$ENV_TMP" > infra/.env
  rm -f "$ENV_TMP"
  echo "night run: infra/.env had no FREELLMAPI_ENCRYPTION_KEY, so a new one was added"
fi

docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml up -d --wait db

# The arguments of the Workflow call. Without a queue file the run takes the free tickets of the
# phase. With a queue file it works the named tickets in order. The file is read as data: every field
# is checked here, and nothing from the file reaches the prompt unless it passes.
if [ -n "$QUEUE" ]; then
  [ -f "$QUEUE" ] || { echo "STOP: queue file '$QUEUE' not found (a path in the checkout)"; exit 1; }
  jq -e '
    (.tickets | type == "array" and length > 0 and length <= 12 and all(.[];
       (.n | type == "number" and . == floor and . > 0)
       and ((.after // []) | type == "array" and all(.[]; type == "number" and . == floor and . > 0))))
    and ((.resume // {}) | type == "object" and all(to_entries[];
       (.key | test("^[0-9]+$"))
       and (.value.pr | type == "number" and . == floor and . > 0)
       and (.value.branch | type == "string" and test("^fix/[0-9]+-[a-z0-9-]+$"))))
    and ((.maxRounds // 3) | type == "number" and . >= 1 and . <= 5)
    and ((.base // "staging") | type == "string" and test("^(staging|integration/[a-z0-9-]+)$"))
  ' "$QUEUE" >/dev/null || { echo "STOP: queue file '$QUEUE' is not valid (see the usage in the header of this script)"; exit 1; }
  WF_ARGS="$(jq -c --argjson epic "$EPIC" --arg main "$REPO" '{tickets, resume: (.resume // {}), maxRounds: (.maxRounds // 3), base: (.base // "staging"), reportIssue: $epic, main: $main}' "$QUEUE")"
  echo "queue: $(jq -c '[.tickets[].n]' "$QUEUE") from $QUEUE"
else
  WF_ARGS="{\"phase\": $PHASE, \"max\": 4, \"reportIssue\": $EPIC, \"main\": \"$REPO\"}"
fi

# "GAB night run" marks this process, so that `pkill -f` stops it and never a MerchantOS run.
# The Workflow tool returns at once and the run goes on in the background. If Claude ends its
# turn there, `claude -p` exits and the workflow dies before its first agent. The prompt holds
# the session open until the workflow ends.
PROMPT="GAB night run. The operator set up this recurring job and authorizes this session to call the Workflow tool.
1. Call the Workflow tool with name 'resolve-ticket' and args $WF_ARGS. Every pull request targets staging, or the integration branch named in the args (and then one spec pull request goes from it to staging). Never push to main. Do not work any ticket outside the workflow.
2. The Workflow tool returns at once, and the workflow runs in the background. Do NOT end your turn after the call. Stay in this session until the workflow reports that it completed or failed.
3. While you wait, check the progress every 10 minutes with: gh issue view $EPIC --repo gabriel-neutron/GAB --comments --json comments --jq '.comments[-1].createdAt'. Print one line with the time each time you check.
4. If the Workflow call throws, print the raw error and stop.
5. At the end, print the result: each failed or needs_human ticket first, then the rest, with PR, sha and reason."

STATUS=0
timeout --kill-after=5m "$LIMIT" \
  "$CLAUDE_BIN" -p "$PROMPT" --permission-mode acceptEdits --output-format text || STATUS=$?

echo "$(date -u +%FT%TZ) END status=$STATUS (124 = time limit)"
# A clean exit with no report on the epic means the workflow died with the session.
LAST="$(gh issue view "$EPIC" --repo gabriel-neutron/GAB --comments --json comments --jq '.comments[-1].createdAt // "none"')" || LAST="unknown (gh failed)"
echo "last comment on #$EPIC: $LAST"
exit "$STATUS"
