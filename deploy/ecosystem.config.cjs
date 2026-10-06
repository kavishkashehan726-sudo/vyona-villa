// PM2 processes for the VYONA app. scripts/deploy-app.sh copies this file into the app folder on
// the server, next to:
//   .env       secrets (from deploy/env.example), read by Node's --env-file, so they stay out of
//              PM2's saved process list
//   current →  releases/<sha>, the release being served
//   media/     photos (imported and uploaded); images/ and backups/
// Paths go through `current`, so a crash restart or `pm2 resurrect` runs the release being
// served, never a pruned one. Deploys delete and start the apps (see scripts/deploy-app.sh).
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const dir = (...p) => path.join(__dirname, ...p);
const envFile = dir('.env');
if (!fs.existsSync(envFile)) throw new Error(`no ${envFile}: copy deploy/env.example there and fill it in`);
const dotenv = parseEnv(fs.readFileSync(envFile, 'utf8'));

// Fixed settings. They win over .env: Node's --env-file never overrides a variable already set.
const env = {
  NODE_ENV: 'production',
  MEDIA_DIR: dir('media'),
  NEXT_PUBLIC_SITE_URL: 'https://vyonaweligama.com',
  ADMIN_URL: 'https://admin.vyonaweligama.com',
  NEXT_TELEMETRY_DISABLED: '1',
};

const app = (name, script, heapMb, limit, extra = {}) => ({
  name,
  script: dir('current', script),
  node_args: [`--env-file=${envFile}`, `--max-old-space-size=${heapMb}`],
  max_memory_restart: limit,
  exp_backoff_restart_delay: 1000, // a crash loop backs off instead of spinning
  log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  ...extra,
  env: { ...env, ...extra.env },
});

module.exports = {
  apps: [
    // Only on 127.0.0.1: CloudPanel's nginx proxies to them.
    app('vyona-web', 'web/apps/web/server.js', 256, '384M', {
      env: { PORT: dotenv.WEB_PORT || '3000', HOSTNAME: '127.0.0.1' },
    }),
    app('vyona-admin', 'admin/apps/admin/server.js', 256, '384M', {
      env: { PORT: dotenv.ADMIN_PORT || '3001', HOSTNAME: '127.0.0.1' },
    }),
    // Time for running jobs to finish when stopped (the worker closes its queues on SIGINT).
    app('vyona-worker', 'worker/worker.mjs', 192, '256M', { kill_timeout: 15000 }),
  ],
};
