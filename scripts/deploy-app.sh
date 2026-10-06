#!/usr/bin/env bash
# Deploys the Phase 1 system (web, admin, worker) to the VPS, where PM2 runs it.
# The release is the one CI built for a commit on main (scripts/build-release.sh); nothing is
# built on the server. Needs `gh` signed in, to download CI's artifact.
#
# Config lives in scripts/deploy.env (gitignored): DEPLOY_HOST, DEPLOY_USER, DEPLOY_PORT,
# DEPLOY_KEY as for deploy.sh, plus DEPLOY_APP_DIR (the app folder on the server).
# The server's own .env (from deploy/env.example) is written there by hand, once.
#
# Usage:
#   scripts/deploy-app.sh              the newest green build of main: upload, migrate, switch, restart
#   scripts/deploy-app.sh --tag <sha>  that commit's build; one still on the server is switched
#                                      back to without migrating (this is the rollback)
#   scripts/deploy-app.sh --images     also copy images/ up, for the photo import
#   scripts/deploy-app.sh --backups    copy the server's backups/ down to ./backups
#   scripts/deploy-app.sh --status     processes, releases, health, the last backup and watchdog log
#   scripts/deploy-app.sh --restart    restart the apps, e.g. after editing the server's .env
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$ROOT/scripts/deploy.env" ] && . "$ROOT/scripts/deploy.env"

: "${DEPLOY_HOST:?set DEPLOY_HOST in scripts/deploy.env}"
: "${DEPLOY_USER:?set DEPLOY_USER in scripts/deploy.env}"
: "${DEPLOY_APP_DIR:?set DEPLOY_APP_DIR in scripts/deploy.env}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/vyona_deploy}"
KEEP=3   # releases kept on the server

COMMON=(-i "$DEPLOY_KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new)
SSH_OPTS=("${COMMON[@]}" -p "$DEPLOY_PORT")   # ssh takes -p
TARGET="$DEPLOY_USER@$DEPLOY_HOST"
APP="$DEPLOY_APP_DIR"
# Non-interactive ssh skips the nvm lines in .bashrc, so node and pm2 are loaded here.
remote() { ssh "${SSH_OPTS[@]}" "$TARGET" "set -e; . \"\$HOME/.nvm/nvm.sh\" >/dev/null 2>&1 || true; cd '$APP'; $1"; }
up() { rsync -az -e "ssh ${SSH_OPTS[*]}" "$@"; }

HEALTH="wp=\$(sed -n 's/^WEB_PORT=//p' .env); ap=\$(sed -n 's/^ADMIN_PORT=//p' .env)
check() { curl -fsS -o /dev/null -w '%{http_code}' \"http://127.0.0.1:\$1/api/health\" 2>/dev/null || true; }"

# Not pm2 reload/restart: in fork mode they stop and start each app in place, and when the old
# process's exit event comes in late, PM2 treats it as a crash and starts a second copy it then
# loses track of. That copy keeps the port and the tracked one loops on EADDRINUSE. After a
# delete, the late exit event is ignored. Either way the apps are down for a second or two.
# The lock keeps watchdog.sh from stepping in meanwhile.
restart() { remote "exec 9>.deploy.lock; flock 9
pm2 delete ecosystem.config.cjs >/dev/null 2>&1 || true
pm2 start ecosystem.config.cjs >/dev/null && pm2 save >/dev/null"; }
health() {
  remote "$HEALTH
for i in \$(seq 1 30); do
  [ \"\$(check \${wp:-3000})\" = 200 ] && [ \"\$(check \${ap:-3001})\" = 200 ] && { echo 'web and admin healthy'; exit 0; }
  sleep 2
done; echo '✗ not healthy after 60 s'; pm2 list; pm2 logs --nostream --lines 30; exit 1"
}

TAG="" IMAGES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --tag) TAG="${2:?--tag needs a commit sha}"; shift 2 ;;
    --images) IMAGES=1; shift ;;
    --backups)
      mkdir -p "$ROOT/backups"
      up "$TARGET:$APP/backups/" "$ROOT/backups/"
      echo "✓ backups in $ROOT/backups"; exit 0 ;;
    --status)
      remote "pm2 list; echo; echo \"current: \$(readlink current)\"; ls -1t releases; echo
$HEALTH
echo \"health: web \$(check \${wp:-3000}) admin \$(check \${ap:-3001})\"
tail -n 3 backups/backup.log 2>/dev/null || echo 'no backup yet'
tail -n 3 watchdog.log 2>/dev/null || echo 'the watchdog has had nothing to do'"; exit 0 ;;
    --restart) echo "→ restart"; restart; health; exit 0 ;;
    *) echo "unknown option: $1"; exit 1 ;;
  esac
done

# The CI run that built the release: the newest green one on main, or the one for --tag.
if [ -n "$TAG" ]; then
  SHA=$(git -C "$ROOT" rev-parse --verify "$TAG^{commit}")
  RUN=$(gh run list -w ci.yml -b main -s success -c "$SHA" -L 1 --json databaseId -q '.[0].databaseId')
else
  read -r SHA RUN < <(gh run list -w ci.yml -b main -s success -L 1 --json headSha,databaseId -q '.[0] | "\(.headSha) \(.databaseId)"') || true
fi
[ -n "${SHA:-}" ] || { echo "✗ no green CI run of main yet"; exit 1; }
echo "→ release ${SHA:0:7}"

ssh "${SSH_OPTS[@]}" "$TARGET" "mkdir -p '$APP/releases' '$APP/media' '$APP/images' '$APP/backups'"
remote "[ -f .env ] || { echo '✗ no .env in $APP: copy deploy/env.example there and fill it in'; exit 1; }
command -v pm2 >/dev/null || { echo '✗ no pm2 for $DEPLOY_USER: see deploy/README.md'; exit 1; }
node -e 'process.exit(+process.versions.node.split(\".\")[0] >= 24 ? 0 : 1)' || { echo '✗ Node 24 is needed'; exit 1; }"

up --chmod=F644 "$ROOT/deploy/ecosystem.config.cjs" "$TARGET:$APP/"
up --chmod=F755 "$ROOT/deploy/backup.sh" "$ROOT/deploy/watchdog.sh" "$TARGET:$APP/"
if [ "$IMAGES" = 1 ]; then
  echo "→ client photos"
  up --chmod=F644,D755 "$ROOT/images/" "$TARGET:$APP/images/"
fi

ROLLBACK=0
if remote "[ -f releases/$SHA/REVISION ]"; then
  [ -n "$TAG" ] && ROLLBACK=1
  echo "→ already on the server"
else
  LOCAL="$ROOT/.release/$SHA"
  if [ ! -f "$LOCAL/REVISION" ]; then
    [ -n "${RUN:-}" ] || { echo "✗ no green CI run for $SHA (CI artifacts are kept 30 days)"; exit 1; }
    echo "→ download from CI run $RUN"
    rm -rf "$ROOT/.release/download" && mkdir -p "$LOCAL"
    gh run download "$RUN" -n vyona-release -D "$ROOT/.release/download"
    tar -xzf "$ROOT/.release/download/vyona.tar.gz" -C "$LOCAL" --strip-components=1
    rm -rf "$ROOT/.release/download"
  fi
  # Files the current release already has become hard links: only what changed is sent and stored.
  echo "→ upload"
  remote "[ -e current ]" && LINK=(--link-dest="$APP/current/") || LINK=()
  up --checksum --delete "${LINK[@]}" "$LOCAL/" "$TARGET:$APP/releases/$SHA.part/"
  remote "rm -rf releases/$SHA && mv releases/$SHA.part releases/$SHA"
fi

if [ "$ROLLBACK" = 0 ]; then
  # Idempotent: the seed never overwrites the owner's edits, and imported photos are skipped.
  echo "→ migrate, seed, photo import"
  remote "cd releases/$SHA/db
node --env-file='$APP/.env' node_modules/prisma/build/index.js migrate deploy
node --env-file='$APP/.env' seed.mjs
IMAGES_DIR='$APP/images' MEDIA_DIR='$APP/media' node --env-file='$APP/.env' media-import.mjs"
fi

echo "→ switch and restart"
remote "touch releases/$SHA && ln -sfn releases/$SHA current.next && mv -Tf current.next current"
restart

echo "→ health"
health

# Keep the newest few; never the one being served.
remote "cur=\$(readlink current); ls -1t releases | grep -v '\.part\$' | tail -n +$((KEEP + 1)) | while read -r r; do
  [ \"releases/\$r\" = \"\$cur\" ] || rm -rf \"releases/\$r\"; done"

echo "✓ deployed ${SHA:0:7}"
