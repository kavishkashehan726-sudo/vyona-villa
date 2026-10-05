import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/seed.ts',
  },
  // `prisma generate` doesn't connect, so CI can run it without a database.
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/vyona' },
});
