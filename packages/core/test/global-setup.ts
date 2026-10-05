import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { ADMIN_DATABASE_URL, TEST_DATABASE_URL } from './db-url';

export default async function setup() {
  const name = new URL(TEST_DATABASE_URL).pathname.slice(1);
  const admin = new pg.Client({ connectionString: ADMIN_DATABASE_URL });
  await admin.connect();
  const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
  if (!rowCount) await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('../../db', import.meta.url)),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });

  const db = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await db.connect();
  const { rows } = await db.query<{ t: string }>(
    `SELECT tablename AS t FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  await db.query(`TRUNCATE ${rows.map((r) => `"${r.t}"`).join(', ')} CASCADE`);
  await db.end();
}
