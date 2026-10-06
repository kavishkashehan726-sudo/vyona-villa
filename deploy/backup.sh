#!/bin/sh
# Nightly from the site user's crontab (deploy/README.md), from the app folder: a dump of the
# database and a tarball of the photos into backups/. Also by hand: ~/app/backup.sh
# Restore a dump: pg_restore -h 127.0.0.1 -U vyona -d vyona --clean --if-exists backups/db-<date>.dump
set -eu
cd "$(dirname "$0")"
umask 077   # the dumps hold guests' names, emails and phone numbers
stamp=$(date -u +%Y-%m-%d)

# Connection from DATABASE_URL in .env (postgresql://user:password@host:port/db). It goes to
# pg_dump through PG* variables, not its arguments, where other users could see it in `ps`.
url=$(sed -n 's/^DATABASE_URL=//p' .env | tail -n 1 | tr -d "\"'")
[ -n "$url" ] || { echo "no DATABASE_URL in .env"; exit 1; }
rest=${url#*://}
creds=${rest%%@*}
hostpart=${rest#*@}
hp=${hostpart%%/*}
db=${hostpart#*/}
export PGUSER="${creds%%:*}" PGPASSWORD="${creds#*:}" PGHOST="${hp%%:*}" PGDATABASE="${db%%\?*}"
case "$hp" in *:*) export PGPORT="${hp##*:}" ;; esac

mkdir -p backups
pg_dump -Fc -f "backups/db-$stamp.dump.part"
mv "backups/db-$stamp.dump.part" "backups/db-$stamp.dump"
tar -czf "backups/media-$stamp.tar.gz.part" -C media .
mv "backups/media-$stamp.tar.gz.part" "backups/media-$stamp.tar.gz"

# Two weeks of dumps; the photos change rarely, so three tarballs.
find backups -name 'db-*.dump' -mtime +14 -delete
find backups -name 'media-*.tar.gz' -mtime +3 -delete
echo "$(date -u +%FT%TZ) backup ok: $(du -h "backups/db-$stamp.dump" | cut -f1) database"
