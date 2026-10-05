// BullMQ queue and job names shared by the apps that enqueue (web, admin) and
// the worker that processes them.

import { Redis } from 'ioredis';

export const QUEUE = {
  /** Beds24: ARI pushes, booking create/cancel, fallback poll. */
  sync: 'sync',
  /** Housekeeping: expire holds, send emails. */
  ops: 'ops',
} as const;

// BullMQ 6 treats ioredis as optional and, under native ESM, wants a client
// instance rather than connection options. Workers need their own connection
// because they issue blocking commands; queues can share one.
export function createRedis() {
  return new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });
}
