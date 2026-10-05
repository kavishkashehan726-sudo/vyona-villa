import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './test/db-url.ts';

export default defineConfig({
  test: {
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: ['./test/global-setup.ts'],
    testTimeout: 30_000,
    // One database for all files, and expireHolds sweeps every room in it.
    fileParallelism: false,
  },
});
