#!/usr/bin/env bash
set -u

PHASE="${1:?phase is required}"
EPIC="${2:?epic is required}"
LIMIT="${GAB_LIMIT:-2h}"

# Do not trust HOME: `su claude` can leave HOME=/root.
USER_HOME="$(getent passwd "$(id -u)" | cut -d: -f6)"
if [ -z "$USER_HOME" ]; then
  echo "ERROR: could not determine the home directory for $(id -un)" >&2
  exit 1
fi
export HOME="$USER_HOME"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO="${GAB_REPO:-$(cd -- "$SCRIPT_DIR/../.." && pwd)}"
LOG_DIR="${GAB_LOG_DIR:-$USER_HOME/logs/gab-night}"
mkdir -p "$LOG_DIR"
umask 077
LOG_FILE="$LOG_DIR/$(date -u +%Y-%m-%dT%H%M%SZ-phase${PHASE}-epic${EPIC}.log)"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "$(date -u +%FT%TZ) START phase=$PHASE epic=$EPIC user=$(id -un) home=$HOME repo=$REPO"
cd "$REPO"

export PATH="$USER_HOME/.local/share/fnm:$PATH"
eval "$(fnm env --shell bash)"
fnm use 24 >/dev/null

GH_TOKEN=""
if [ -f .claude/settings.local.json ] && command -v jq >/dev/null 2>&1; then
  GH_TOKEN="$(jq -er '.env.GH_TOKEN // empty' .claude/settings.local.json 2>/dev/null || true)"
fi
if [ -z "$GH_TOKEN" ]; then
  GH_TOKEN="$(printf 'protocol=https
host=github.com

' | git credential fill 2>/dev/null | awk -F= '$1 == "password" { print substr($0, 10); exit }')"
fi
if [ -z "$GH_TOKEN" ]; then
  echo "ERROR: GitHub access token is not available"
  exit 1
fi
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

PROMPT="GAB night run. Run the resolve-ticket workflow with args {\"phase\": $PHASE, \"max\": 4, \"reportIssue\": $EPIC}. Every pull request targets staging. Never push to main."

STATUS=0
CLAUDE_BIN="${CLAUDE_BIN:-$(command -v claude || true)}"
if [ -z "$CLAUDE_BIN" ]; then
  echo "ERROR: claude executable not found for user $(id -un)"
  STATUS=127
else
  timeout --kill-after=5m "$LIMIT" "$CLAUDE_BIN" -p "$PROMPT" --permission-mode acceptEdits --output-format text || STATUS=$?
fi

echo "$(date -u +%FT%TZ) END status=$STATUS (124 = time limit)"
exit "$STATUS"
