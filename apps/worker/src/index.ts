// Background worker: everything that must not block a guest's request.
// Jobs are added by web and admin; handlers arrive in build steps 4 and 6.

import { QUEUE, createRedis } from '@vyona/core';
import { prisma } from '@vyona/db';
import { Worker, type Job } from 'bullmq';

async function handle(job: Job) {
  console.log(`[${job.queueName}] ${job.name} #${job.id} — no handler yet`, job.data);
}

const workers = Object.values(QUEUE).map(
  (name) =>
    new Worker(name, handle, { connection: createRedis(), concurrency: 4 })
      .on('failed', (job, err) => console.error(`[${name}] ${job?.name} #${job?.id} failed:`, err.message))
      .on('error', (err) => console.error(`[${name}]`, err.message)),
);

await prisma.$queryRaw`SELECT 1`;
console.log(`✓ worker up: queues ${Object.values(QUEUE).join(', ')}`);

async function shutdown(signal: string) {
  console.log(`${signal}: closing workers`);
  await Promise.all(workers.map((w) => w.close()));
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
