# Production

The Phase 1 system runs on the VPS under **PM2**, as the site user `vyonaweligama`:

- the public site (`vyona-web`, :3020);
- the admin (`vyona-admin`, :3021);
- the worker (`vyona-worker`).

Postgres and Redis run on the server itself. CI builds the release; the server only unpacks it,
because it has too little RAM to build. CloudPanel's nginx terminates HTTPS behind Cloudflare
and proxies to the two local ports.

| File | What it is |
|---|---|
| `ecosystem.config.cjs` | the three PM2 processes, with memory limits; ports bound to 127.0.0.1 |
| `backup.sh` | nightly `pg_dump` and photo tarball into `backups/` |
| `watchdog.sh` | starts the apps at boot, and again whenever PM2 can't bring them back |
| `env.example` | template for the server's `.env` (secrets live there, never in git) |
| `../scripts/build-release.sh` | assembles the release (CI runs it on main) |
| `../scripts/deploy-app.sh` | has the server fetch CI's release, migrates, switches, restarts, checks health |

On the server, everything lives in `~/app`:

```
.env                  secrets (chmod 600)
ecosystem.config.cjs  copied up by every deploy
current → releases/<sha>
releases/<sha>/       web/  admin/  worker/  db/  REVISION   (the newest three are kept)
media/                photos: imported from images/, and uploaded in the admin
images/               the client's originals, for the import
backups/              nightly dumps
```

## One-time setup

### 1. As root, once

The server needs Postgres and Redis. Check `openssl version` first: it must report 3.x
(Debian 12 or Ubuntu 22.04 and later), because the release's Prisma engine is built for it.

**Postgres 17**, the version used in development and CI. If it's already installed (the VPS has
Debian's `postgresql-17`), skip to creating the role. The password is read from the app's `.env`,
written first (step 4), so it's never typed or shown:

```bash
sudo -u postgres psql -v pw="$(sed -n 's|^DATABASE_URL=postgresql://vyona:\([^@]*\)@.*|\1|p' /home/vyonaweligama/app/.env)" <<'SQL'
CREATE ROLE vyona LOGIN PASSWORD :'pw';
CREATE DATABASE vyona OWNER vyona;
SQL
```

On a fresh server:

```bash
apt install -y postgresql-common
/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
apt install -y postgresql-17
sudo -u postgres psql <<'SQL'
CREATE ROLE vyona LOGIN PASSWORD '<hex password, also in .env>';
CREATE DATABASE vyona OWNER vyona;
-- Small settings for a seven-room villa on a shared VPS.
ALTER SYSTEM SET shared_buffers = '64MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET max_connections = 40;
SQL
systemctl restart postgresql
```

It listens on localhost only by default; keep it that way. On a Postgres that other sites share,
leave the `ALTER SYSTEM` settings out.

**Redis.** Run `apt install -y redis-server`, then set these in `/etc/redis/redis.conf`:

```
bind 127.0.0.1 -::1
maxmemory 64mb
maxmemory-policy noeviction
appendonly yes
```

Then run `systemctl restart redis-server`. BullMQ needs `noeviction`, because a dropped key
would be a lost job. On a Redis that other sites share, check the policy
(`redis-cli config get maxmemory-policy`) and give VYONA its own database number in
`REDIS_URL` (the VPS uses `/5`). If the policy isn't `noeviction`, VYONA needs its own
instance on another port.

### 2. As the site user: Node 24 and PM2

```bash
ssh -i ~/.ssh/vyona_deploy vyonaweligama@<server>
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
. ~/.nvm/nvm.sh
nvm install 24 && nvm alias default 24
npm install -g pm2
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 3
```

Then open `crontab -e` and add these lines (no root needed). The first two run `watchdog.sh`,
which starts the apps after a reboot and checks them every 5 minutes (see *Self-healing*). The
third runs the backup at 02:30 Colombo time. Cron uses the server's clock, which on the VPS is
Colombo time (`date` shows `+0530`); on a UTC server, write `0 21` instead.

```
@reboot $HOME/app/watchdog.sh
*/5 * * * * $HOME/app/watchdog.sh
30 2 * * * $HOME/app/backup.sh >> $HOME/app/backups/backup.log 2>&1
```

### 3. In CloudPanel

1. Change **vyonaweligama.com** from a static site to a *Reverse Proxy* site pointing at
   `http://127.0.0.1:3020` (`WEB_PORT`), at the cut-over (see the last section).
2. Add a *Reverse Proxy* site **admin.vyonaweligama.com** → `http://127.0.0.1:3021`
   (`ADMIN_PORT`).
3. Issue a Let's Encrypt certificate for each. The admin needs a proxied (orange) `admin` DNS
   record in Cloudflare first.
4. In the admin site's vhost, raise the upload limit so phone photos get through:
   `client_max_body_size 16m;`

Cloudflare SSL stays on **Full**. Full (strict) is fine once both sites have their Let's Encrypt
certificates.

### 4. The server's `.env`

```bash
mkdir -p ~/app && cd ~/app
nano .env        # paste deploy/env.example and fill it in
chmod 600 .env
```

`DATABASE_URL` carries the password given to the `vyona` role in step 1. `ADMIN_EMAIL` and
`ADMIN_PASSWORD` create the first login once; after that, the password is changed in the admin.

### 5. First deploy

On your machine, `gh` must be signed in: it finds CI's release and asks GitHub for a download
link for the server. Add
`DEPLOY_APP_DIR=/home/vyonaweligama/app` to `scripts/deploy.env`, then:

```bash
scripts/deploy-app.sh --images   # also copies images/ up for the first photo import
```

## Every deploy

Push to `main`. CI runs the checks, then builds the release and keeps it as the run's
`vyona-release` artifact for 30 days. When it's green:

```bash
scripts/deploy-app.sh                 # the newest green build of main
scripts/deploy-app.sh --tag <sha>     # one exact build; also how to roll back
scripts/deploy-app.sh --status        # processes, releases, health, last backup
scripts/deploy-app.sh --restart       # restart the apps, e.g. after editing .env
```

A deploy does these steps in order:

1. Asks GitHub for a download link to CI's release. The link is signed and valid for about a
   minute, so the server needs no GitHub token.
2. The server downloads the release (about 105 MB, a few seconds) and unpacks it into
   `releases/<sha>`. Files the current release already has become hard links, so a deploy that
   changes only code stores only that code.
3. Runs migrations, the seed and the photo import from the new release. All three are
   idempotent: the seed never overwrites what the owner edits in the admin.
4. Switches `current`, then deletes and starts the PM2 apps (see below).
5. Waits for both `/api/health` checks.

The site is down for a second or two while the apps restart. The script doesn't use
`pm2 reload` or `pm2 restart`: in PM2's fork mode they can start an app twice, and the copy
PM2 loses track of keeps the port while the tracked one fails. Use `--restart` instead of
running those by hand.

**Rolling back.** `--tag` with a release that is still on the server only switches back and
restarts. Migrations aren't undone, so write schema changes in two steps. For example, first add
the new column, then drop the old one in a later deploy. That way the previous build still runs
against the new schema.

**Logs.** Run `pm2 logs`, or `pm2 logs vyona-worker --lines 100`. They're kept in `~/.pm2/logs`,
rotated at 10 MB with three files kept.

## Self-healing

| What happens | What brings it back |
|---|---|
| An app crashes | PM2, at once. A crash loop backs off, up to 15 s between tries. |
| An app grows past its memory limit | PM2 restarts it. |
| Postgres or Redis goes down | Nothing needs restarting: the apps stay up, `/api/health` answers 503, and they reconnect when it's back. |
| The server reboots | `watchdog.sh` from `@reboot`. Postgres, Redis, nginx and cron start on their own (systemd). |
| The PM2 daemon dies, or an app ends up stopped or errored | `watchdog.sh`, within 5 minutes. |
| An app is online but its port doesn't answer, or a lost copy holds the port | `watchdog.sh` stops whatever holds the port, then starts the apps. |

The watchdog does nothing while all three apps are online and both ports answer. It waits
30 seconds and checks again before acting, so it doesn't step on a restart PM2 is already doing,
and it skips a run while a deploy holds `.deploy.lock`. Everything it does goes to
`~/app/watchdog.log`, which `--status` shows.

## Backups

Every night, `backup.sh` writes these to `~/app/backups`:

- `db-<date>.dump`, kept for 14 days;
- `media-<date>.tar.gz` of the photos, kept for 3 days.

The files are readable only by the site user, because the dumps hold guest details. The log is
`backups/backup.log`.

```bash
scripts/deploy-app.sh --backups       # on your machine: copies them to ./backups (gitignored)
~/app/backup.sh                       # on the server: a backup right now
pg_restore -h 127.0.0.1 -U vyona -d vyona --clean --if-exists backups/db-<date>.dump
```

A backup that stays on the same disk doesn't protect against losing the server. Pull the
backups regularly.

## Memory

| Process | Heap | Restarted above |
|---|---|---|
| vyona-web | 256 MB | 384 MB |
| vyona-admin | 256 MB | 384 MB |
| vyona-worker | 192 MB | 256 MB |

Postgres stays small: 64 MB of shared buffers and 40 connections. Redis is capped at 64 MB.
PM2 doesn't hard-cap memory the way a container limit does. It restarts a process that grows
past its limit, and the heap cap keeps Node's own garbage collector inside it.

## Cut-over from the prototype

The static prototype stays live at the apex until the client signs off the new site.
To switch over:

1. Deploy, and check the site on its port through an SSH tunnel:
   `ssh -L 3020:127.0.0.1:3020 …`, then http://localhost:3020.
2. Turn the CloudPanel site into the reverse proxy (step 3 above).
3. Purge the Cloudflare cache, because the prototype's photos are cached at the edge.
4. Once real prices are confirmed, set `SITE_INDEXABLE=1` in `.env` and run
   `scripts/deploy-app.sh --restart`. `robots.txt` and the `noindex` tag both follow
   the setting, with no rebuild needed.
5. Set the PayHere notify URL and the Beds24 webhook to the live domain.
