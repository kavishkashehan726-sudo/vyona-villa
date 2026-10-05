#!/usr/bin/env bash
# Deploys the web build (.dist/web) to the CloudPanel static site.
#
# Config lives in scripts/deploy.env (gitignored, copy from deploy.env.example).
# Usage: scripts/deploy.sh [--build]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$ROOT/scripts/deploy.env" ] && . "$ROOT/scripts/deploy.env"

: "${DEPLOY_HOST:?set DEPLOY_HOST in scripts/deploy.env}"
: "${DEPLOY_USER:?set DEPLOY_USER in scripts/deploy.env}"
: "${DEPLOY_PATH:?set DEPLOY_PATH in scripts/deploy.env}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/vyona_deploy}"

SRC="$ROOT/.dist/web"
COMMON=(-i "$DEPLOY_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
SSH_OPTS=("${COMMON[@]}" -p "$DEPLOY_PORT")   # ssh takes -p
TARGET="$DEPLOY_USER@$DEPLOY_HOST"

if [ "${1:-}" = "--build" ]; then
  echo "→ building"
  (cd "$ROOT" && docker compose run --rm prototype npm run build:web)
fi

[ -f "$SRC/index.html" ] || { echo "✗ $SRC/index.html not found — run with --build first"; exit 1; }

echo "→ photos → $TARGET:$DEPLOY_PATH/assets"
# Assets go up first, so index.html is never live while a photo it names is missing.
rsync -az --delete --chmod=F644,D755 \
  -e "ssh ${SSH_OPTS[*]}" "$SRC/assets/" "$TARGET:$DEPLOY_PATH/assets/"

echo "→ document"
rsync -az --chmod=F644 -e "ssh ${SSH_OPTS[*]}" "$SRC/index.html" "$TARGET:$DEPLOY_PATH/index.html"

# robots.txt keeps the prototype out of search results while prices are placeholders.
ssh "${SSH_OPTS[@]}" "$TARGET" "cat > '$DEPLOY_PATH/robots.txt'" <<'ROBOTS'
User-agent: *
Disallow: /
ROBOTS

ssh "${SSH_OPTS[@]}" "$TARGET" "
  set -e
  cd '$DEPLOY_PATH'
  chmod 644 robots.txt
  printf 'document: '; du -h index.html | cut -f1
  printf 'photos:   %s files, ' \"\$(ls assets | wc -l)\"; du -sh assets | cut -f1
"

echo "✓ live at https://vyonaweligama.com"
