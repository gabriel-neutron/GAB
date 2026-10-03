#!/usr/bin/env bash
# The night run of GAB on the VPS. Cron starts it (infra/vps/README.md, step 6).
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

REPO="${GAB_REPO:-/root/projects/GAB}"
LOG_DIR="${GAB_LOG_DIR:-/root/logs/gab-night}"
LOCK="/var/lock/gab-night.lock"
# The whole run stops after this time. Claude Code gets SIGTERM, then SIGKILL 5 minutes later.
LIMIT="${GAB_NIGHT_LIMIT:-5h}"

mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date -u +%Y-%m-%dT%H%M)Z-phase$PHASE.log"
exec >>"$LOG" 2>&1

# One run at a time. A second run that finds the lock held stops at once.
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(date -u +%FT%TZ) STOP: another night run holds $LOCK"
  exit 0
fi

echo "$(date -u +%FT%TZ) START phase=$PHASE epic=$EPIC"
cd "$REPO"

# Node 24 for GAB. MerchantOS keeps the default node of the host.
export PATH="/root/.local/share/fnm:$PATH"
eval "$(fnm env --shell bash)"
fnm use 24 >/dev/null

# The token stays in the settings file. It is read into the environment and never printed.
GH_TOKEN="$(jq -er '.env.GH_TOKEN' .claude/settings.local.json)"
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
PROMPT="GAB night run. Run the resolve-ticket workflow with args {\"phase\": $PHASE, \"max\": 4, \"reportIssue\": $EPIC}. Every pull request targets staging. Never push to main."

STATUS=0
timeout --kill-after=5m "$LIMIT" \
  claude -p "$PROMPT" --permission-mode acceptEdits --output-format text || STATUS=$?

echo "$(date -u +%FT%TZ) END status=$STATUS (124 = time limit)"
exit "$STATUS"
