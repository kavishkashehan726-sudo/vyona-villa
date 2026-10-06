#!/usr/bin/env bash
# At boot and every 5 minutes, from the site user's crontab (deploy/README.md). PM2 restarts an
# app that crashes; this brings the apps back when PM2 can't:
#   - after a reboot, and after the PM2 daemon itself died (the OOM killer, `pm2 kill`);
#   - when an app is stopped or errored, or online but not answering on its port;
#   - when a copy PM2 lost track of holds a port (see the reload gotcha in CLAUDE.md).
# While the apps are fine it does nothing and writes nothing. A 503 from /api/health counts as
# answering: that is Postgres or Redis being down, and the apps reconnect on their own.
set -uo pipefail
cd "$(dirname "$0")"
. "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
[ -e current ] || exit 0   # nothing deployed yet
exec 9>.deploy.lock
flock -n 9 || exit 0       # a deploy is restarting the apps

log() { echo "$(date '+%F %T %z') $*" >> watchdog.log; }
ports=$(sed -n 's/^\(WEB\|ADMIN\)_PORT=//p' .env)
ports=${ports:-3000 3001}

# vyona-* apps PM2 reports online. `pm2 ping` starts the daemon first if it isn't running.
online() {
  pm2 ping >/dev/null 2>&1
  pm2 jlist 2>/dev/null | node -e '
    let s = "";
    process.stdin.on("data", (d) => (s += d)).on("end", () => {
      const list = JSON.parse(s.slice(s.indexOf("[")) || "[]");
      console.log(list.filter((p) => p.name.startsWith("vyona-") && p.pm2_env.status === "online").length);
    });'
}
# Every port gives an HTTP answer, whatever the status, within 10 s.
answering() {
  for p in $ports; do
    [ "$(curl -s -o /dev/null -m 10 -w '%{http_code}' "http://127.0.0.1:$p/api/health")" != 000 ] || return 1
  done
}
healthy() { [ "$(online)" = 3 ] && answering; }

healthy && exit 0
sleep 30   # an app PM2 is restarting, or one still starting, gets time first
healthy && exit 0

log "$(online)/3 online or a port not answering: starting the apps again"
pm2 delete ecosystem.config.cjs >/dev/null 2>&1
for p in $ports; do   # whatever still holds a port is a copy PM2 doesn't know about
  for pid in $(ss -ltnpH "sport = :$p" | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u); do
    log "stopping untracked process $pid on :$p"
    kill "$pid" 2>/dev/null
  done
done
sleep 2
pm2 start ecosystem.config.cjs >/dev/null && pm2 save >/dev/null
sleep 20
if healthy; then log "back up"; else log "still not healthy: see pm2 logs"; fi
