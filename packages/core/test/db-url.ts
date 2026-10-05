// Integration tests run against their own database next to the dev one, so a
// test run never touches the seeded data.
const base = process.env.DATABASE_URL ?? 'postgresql://vyona:vyona@localhost:5432/vyona';
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? base.replace(/\/[^/?]+(?=\?|$)/, '/vyona_test');
export const ADMIN_DATABASE_URL = base;
