import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/client';

export * from './generated/client';

// One client per process. Next.js dev reloads modules on every change, so the
// instance is parked on globalThis instead of being created per reload.
const g = globalThis as unknown as { __vyonaPrisma?: PrismaClient };

// The adapter connects on the first query, not here, so importing this module
// during `next build` without a database is fine.
function create() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
}

export const prisma = g.__vyonaPrisma ?? create();
if (process.env.NODE_ENV !== 'production') g.__vyonaPrisma = prisma;
