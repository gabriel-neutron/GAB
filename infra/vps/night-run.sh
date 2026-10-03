#!/usr/bin/env bash
# The night run of GAB on the VPS. Cron of the user `claude` starts it (infra/vps/README.md, step 6).
#
# Usage: night-run.sh <phase> <epic>
#   phase  the issue number of the phase ticket (args.phase of resolve-ticket)
#   epic   the issue number that gets the run report
#
# The script stops before Claude Code starts when one of these is false:
#   - no other night run holds the lock;
#   - the GitHub identity is gabriel-neutron;
#   - the checkout is on staging and is clean;
#   - the disposable test stack is healthy.
set -euo pipefail

PHASE="${1:?give the phase number}"
EPIC="${2:?give the epic issue number}"
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

docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml up -d --wait db

# "GAB night run" marks this process, so that `pkill -f` stops it and never a MerchantOS run.
# The Workflow tool returns at once and the run goes on in the background. If Claude ends its
# turn there, `claude -p` exits and the workflow dies before its first agent. The prompt holds
# the session open until the workflow ends.
PROMPT="GAB night run. The operator set up this recurring job and authorizes this session to call the Workflow tool.
1. Call the Workflow tool with name 'resolve-ticket' and args {\"phase\": $PHASE, \"max\": 4, \"reportIssue\": $EPIC, \"main\": \"$REPO\"}. Every pull request targets staging. Never push to main. Do not work any ticket outside the workflow.
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
